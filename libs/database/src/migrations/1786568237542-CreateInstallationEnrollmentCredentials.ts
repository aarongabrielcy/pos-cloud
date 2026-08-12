import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CLOUD-01C-C - Installation Enrollment / Credentials / Activation.
 *
 * Adds two tables to the existing `installations` schema (introduced by CreateControlPlaneCore):
 *   - installations.installation_enrollments - one-time enrollment codes (INITIAL or RECOVERY),
 *                                               mirrors domain/installation-enrollment.ts
 *   - installations.installation_credentials - permanent (until revoked) machine bearer credentials,
 *                                               mirrors domain/installation-credential.ts
 *
 * Both live in the `installations` schema, not `access_management` - this data belongs to
 * Installation identity, which is deliberately independent of AdminUser identity (see
 * docs/architecture/installation-enrollment.md#principles). Same-context FKs only (no FK crosses a
 * schema boundary - see ADR-010): both tables reference installations.installations(id).
 *
 * Two structural invariants enforced here at the database level, not only in application code:
 *   - at most one OPEN enrollment (consumed_at IS NULL AND revoked_at IS NULL) per installation_id
 *     at a time (CORRECTION #2 - two admins issuing enrollment for the same Installation concurrently
 *     must not both succeed with two simultaneously-open codes)
 *   - at most one ACTIVE (non-revoked) credential per installation_id at a time
 *
 * NOT executed by this task. The user runs `pnpm migration:run` when ready.
 */
export class CreateInstallationEnrollmentCredentials1786568237542 implements MigrationInterface {
  name = "CreateInstallationEnrollmentCredentials1786568237542";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- installations.installation_enrollments --------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE installations.installation_enrollments (
        id              uuid PRIMARY KEY,
        installation_id uuid NOT NULL,
        purpose         varchar(20) NOT NULL,
        code_hash       varchar(64) NOT NULL,
        created_at      timestamptz NOT NULL,
        expires_at      timestamptz NOT NULL,
        consumed_at     timestamptz NULL,
        revoked_at      timestamptz NULL,
        CONSTRAINT fk_installation_enrollments_installation_id
          FOREIGN KEY (installation_id) REFERENCES installations.installations (id) ON DELETE CASCADE,
        CONSTRAINT ck_installation_enrollments_purpose CHECK (purpose IN ('INITIAL', 'RECOVERY')),
        -- Mirrors InstallationSecretGeneratorPort's hashSecret output shape: SHA-256 hex digest.
        CONSTRAINT ck_installation_enrollments_code_hash_format CHECK (code_hash ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_installation_enrollments_expiry_after_creation CHECK (expires_at > created_at)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX ix_installation_enrollments_installation_id
        ON installations.installation_enrollments (installation_id)
    `);

    // Structural backstop for "at most one open enrollment per Installation" - see
    // IssueInstallationEnrollmentUseCase, which also enforces this by revoking any prior open
    // enrollment inside the same locked transaction before inserting a new one. Deliberately does
    // NOT include `expires_at > now()` in the predicate: an expired-but-not-yet-revoked enrollment
    // still structurally occupies the "open" slot until the next issuance explicitly revokes it.
    await queryRunner.query(`
      CREATE UNIQUE INDEX ux_installation_enrollments_installation_id_open
        ON installations.installation_enrollments (installation_id)
        WHERE consumed_at IS NULL AND revoked_at IS NULL
    `);

    // --- installations.installation_credentials ---------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE installations.installation_credentials (
        id              uuid PRIMARY KEY,
        installation_id uuid NOT NULL,
        secret_hash     varchar(64) NOT NULL,
        created_at      timestamptz NOT NULL,
        revoked_at      timestamptz NULL,
        CONSTRAINT fk_installation_credentials_installation_id
          FOREIGN KEY (installation_id) REFERENCES installations.installations (id) ON DELETE CASCADE,
        CONSTRAINT ck_installation_credentials_secret_hash_format CHECK (secret_hash ~ '^[0-9a-f]{64}$')
      )
    `);

    // Structural backstop for "at most one active credential per Installation" - see
    // EnrollInstallationUseCase, which also enforces this by revoking any existing active credential
    // inside the same locked transaction before inserting the new one.
    await queryRunner.query(`
      CREATE UNIQUE INDEX ux_installation_credentials_installation_id_active
        ON installations.installation_credentials (installation_id)
        WHERE revoked_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS installations.installation_credentials`);
    await queryRunner.query(`DROP TABLE IF EXISTS installations.installation_enrollments`);
  }
}
