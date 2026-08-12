import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CLOUD-01B - Control Plane Core.
 *
 * Creates the first three bounded-context schemas and their tables:
 *   - control_plane.customers
 *   - licensing.licenses
 *   - licensing.license_entitlements
 *   - installations.installations
 *
 * Same-context FK only: licensing.license_entitlements -> licensing.licenses (ON DELETE CASCADE).
 * No FK crosses a schema boundary (control_plane.customers, licensing.licenses are referenced
 * only logically, by UUID, from other schemas - see ADR-010). Cross-context consistency is
 * enforced at the application layer via ports (CustomerReaderPort, LicenseReaderPort), never by
 * PostgreSQL.
 *
 * Defense-in-depth (CLOUD-01B-FIX): every Domain-level invariant that can be expressed as a
 * stateless CHECK is mirrored here, so a direct/administrative SQL write - not just a request
 * that went through Application/Domain - cannot create a row Domain would have rejected. This is
 * a safety net, not a replacement for Domain validation: Domain remains the source of truth for
 * normalization (trim/uppercase) and any rule that needs more context than a single row.
 *
 * Schema ownership: CREATE SCHEMA (no IF NOT EXISTS) - this migration is what introduces and owns
 * `control_plane`, `licensing`, and `installations` on a fresh POSPlatform database. If one of
 * these schemas already exists, that is unexpected shared state this migration does not own, and
 * `up()` must fail loudly instead of silently adopting it. Symmetrically, `down()` does not use
 * CASCADE: if any object other than what this migration created still lives in one of these
 * schemas, DROP SCHEMA fails safely instead of deleting someone else's data.
 *
 * NOT executed by this task. The user runs `pnpm migration:run` when ready.
 */
export class CreateControlPlaneCore1786312046358 implements MigrationInterface {
  name = "CreateControlPlaneCore1786312046358";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Schemas ---------------------------------------------------------------------------
    // No "IF NOT EXISTS": this migration owns these schemas outright. If one already exists,
    // that's unexpected shared state - fail loudly rather than silently adopting it.
    await queryRunner.query(`CREATE SCHEMA control_plane`);
    await queryRunner.query(`CREATE SCHEMA licensing`);
    await queryRunner.query(`CREATE SCHEMA installations`);

    // --- control_plane.customers -------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE control_plane.customers (
        id uuid PRIMARY KEY,
        code varchar(50) NOT NULL,
        legal_name varchar(200) NOT NULL,
        trade_name varchar(200) NULL,
        status varchar(20) NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT uq_customers_code UNIQUE (code),
        CONSTRAINT ck_customers_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
        -- Mirrors CustomerCode's Domain pattern (customer-code.ts): normalized (trim+uppercase)
        -- form only. Domain remains responsible for normalization; this only rejects what Domain
        -- would never have produced.
        CONSTRAINT ck_customers_code_format CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,49}$'),
        -- Mirrors CustomerName's Domain bounds (customer-name.ts) - trimmed length only, not the
        -- full Domain rule set. VARCHAR already bounds the maximum.
        CONSTRAINT ck_customers_legal_name_length CHECK (char_length(btrim(legal_name)) >= 2),
        CONSTRAINT ck_customers_trade_name_length
          CHECK (trade_name IS NULL OR char_length(btrim(trade_name)) >= 1)
      )
    `);

    // --- licensing.licenses --------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE licensing.licenses (
        id uuid PRIMARY KEY,
        customer_id uuid NOT NULL,
        license_number varchar(80) NOT NULL,
        edition varchar(20) NOT NULL,
        license_model varchar(20) NOT NULL,
        status varchar(20) NOT NULL,
        valid_from timestamptz NOT NULL,
        valid_until timestamptz NULL,
        max_installations integer NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT uq_licenses_license_number UNIQUE (license_number),
        CONSTRAINT ck_licenses_edition CHECK (edition IN ('BASIC', 'PREMIUM')),
        CONSTRAINT ck_licenses_license_model CHECK (license_model IN ('PERPETUAL', 'SUBSCRIPTION')),
        CONSTRAINT ck_licenses_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED')),
        CONSTRAINT ck_licenses_max_installations CHECK (max_installations >= 1),
        CONSTRAINT ck_licenses_valid_until_after_valid_from
          CHECK (valid_until IS NULL OR valid_until > valid_from),
        CONSTRAINT ck_licenses_perpetual_no_valid_until
          CHECK (license_model <> 'PERPETUAL' OR valid_until IS NULL),
        CONSTRAINT ck_licenses_subscription_requires_valid_until
          CHECK (license_model <> 'SUBSCRIPTION' OR valid_until IS NOT NULL),
        -- Commercial rule (CLOUD-01B): BASIC=>PERPETUAL, PREMIUM=>SUBSCRIPTION. This is the
        -- constraint that actually enforces it - the valid_until checks above only cover the
        -- license_model=>valid_until side, not edition=>license_model itself.
        CONSTRAINT ck_licenses_edition_license_model
          CHECK (
            (edition = 'BASIC' AND license_model = 'PERPETUAL')
            OR
            (edition = 'PREMIUM' AND license_model = 'SUBSCRIPTION')
          ),
        -- Mirrors LicenseNumber's Domain pattern (license-number.ts): normalized form only.
        CONSTRAINT ck_licenses_license_number_format
          CHECK (license_number ~ '^[A-Z0-9][A-Z0-9_-]{4,79}$')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_licenses_customer_id ON licensing.licenses (customer_id)`,
    );
    await queryRunner.query(`CREATE INDEX idx_licenses_status ON licensing.licenses (status)`);
    await queryRunner.query(`CREATE INDEX idx_licenses_edition ON licensing.licenses (edition)`);

    // --- licensing.license_entitlements ---------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE licensing.license_entitlements (
        id uuid PRIMARY KEY,
        license_id uuid NOT NULL,
        code varchar(100) NOT NULL,
        enabled boolean NOT NULL,
        configuration jsonb NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT uq_license_entitlements_license_id_code UNIQUE (license_id, code),
        CONSTRAINT fk_license_entitlements_license_id
          FOREIGN KEY (license_id) REFERENCES licensing.licenses (id) ON DELETE CASCADE,
        -- Mirrors EntitlementCode's Domain pattern (entitlement-code.ts): snake_case, lowercase.
        -- Not normalized by Domain (no trim/case conversion) - the raw value is what's stored.
        CONSTRAINT ck_license_entitlements_code CHECK (code ~ '^[a-z][a-z0-9_]{2,99}$'),
        -- Mirrors the "configuration is NULL or a JSON object" Domain rule
        -- (InvalidEntitlementConfigurationError) - rejects arrays/scalars at the top level.
        CONSTRAINT ck_license_entitlements_configuration_object
          CHECK (configuration IS NULL OR jsonb_typeof(configuration) = 'object')
      )
    `);
    // No separate index on (license_id): the UNIQUE B-tree on (license_id, code) already serves
    // lookups filtered by license_id alone (leftmost-prefix), so a dedicated single-column index
    // would be redundant write overhead with no read benefit.

    // --- installations.installations -----------------------------------------------------------
    // No FK to control_plane.customers or licensing.licenses - cross-schema, resolved via
    // CustomerReaderPort/LicenseReaderPort at the application layer (see ADR-010).
    await queryRunner.query(`
      CREATE TABLE installations.installations (
        id uuid PRIMARY KEY,
        customer_id uuid NOT NULL,
        license_id uuid NOT NULL,
        installation_code varchar(80) NOT NULL,
        name varchar(150) NOT NULL,
        platform varchar(20) NOT NULL,
        status varchar(20) NOT NULL,
        registered_at timestamptz NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT uq_installations_installation_code UNIQUE (installation_code),
        CONSTRAINT ck_installations_platform CHECK (platform IN ('WINDOWS', 'ANDROID', 'IOS')),
        CONSTRAINT ck_installations_status
          CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'DECOMMISSIONED')),
        -- Mirrors InstallationCode's Domain pattern (installation-code.ts): normalized form only.
        CONSTRAINT ck_installations_installation_code_format
          CHECK (installation_code ~ '^[A-Z0-9][A-Z0-9_-]{4,79}$'),
        -- Mirrors the Domain trimmed-length floor (installation.ts's validateName).
        CONSTRAINT ck_installations_name_length CHECK (char_length(btrim(name)) >= 1)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_installations_customer_id ON installations.installations (customer_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_installations_license_id ON installations.installations (license_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_installations_status ON installations.installations (status)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS installations.installations`);
    await queryRunner.query(`DROP TABLE IF EXISTS licensing.license_entitlements`);
    await queryRunner.query(`DROP TABLE IF EXISTS licensing.licenses`);
    await queryRunner.query(`DROP TABLE IF EXISTS control_plane.customers`);
    // No CASCADE: if anything other than what this migration created still lives in one of these
    // schemas, DROP SCHEMA fails safely instead of deleting someone else's objects.
    await queryRunner.query(`DROP SCHEMA installations`);
    await queryRunner.query(`DROP SCHEMA licensing`);
    await queryRunner.query(`DROP SCHEMA control_plane`);
  }
}
