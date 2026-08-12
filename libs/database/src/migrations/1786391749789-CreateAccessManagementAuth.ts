import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CLOUD-01C-A - Admin Identity & Authentication Foundation.
 *
 * Creates the `access_management` schema and its two tables:
 *   - access_management.admin_users
 *   - access_management.admin_sessions
 *
 * Same-context FKs only: admin_sessions.admin_user_id -> admin_users.id (ON DELETE CASCADE - a
 * session has no meaning without its AdminUser); admin_sessions.replaced_by_session_id ->
 * admin_sessions.id (ON DELETE SET NULL - the rotation chain reference, not an ownership
 * relationship, so deleting the replacing session must not cascade-delete the one it replaced).
 * No FK crosses a schema boundary (see ADR-010) - this context does not reference any other
 * bounded context's tables in CLOUD-01C-A (see docs/architecture/admin-authentication.md).
 *
 * Defense-in-depth (same policy as CreateControlPlaneCore/CLOUD-01B-FIX): every Domain-level
 * invariant expressible as a stateless CHECK is mirrored here, so a direct/administrative SQL
 * write cannot create a row Domain would have rejected. Domain remains the source of truth for
 * normalization (trim/lowercase) and any rule needing more context than a single row (e.g. the
 * failed-login-attempts/lockout state machine itself, which this migration only bounds, not
 * enforces).
 *
 * Schema ownership: CREATE SCHEMA (no IF NOT EXISTS) - this migration is what introduces and owns
 * `access_management` on top of CLOUD-01B's `control_plane`/`licensing`/`installations`. `down()`
 * does not use CASCADE, matching CreateControlPlaneCore's own rationale.
 *
 * NOT executed by this task. The user runs `pnpm migration:run` when ready - see this task's final
 * report for the required migration-source review before doing so.
 */
export class CreateAccessManagementAuth1786391749789 implements MigrationInterface {
  name = "CreateAccessManagementAuth1786391749789";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Schema -----------------------------------------------------------------------------
    await queryRunner.query(`CREATE SCHEMA access_management`);

    // --- access_management.admin_users ---------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE access_management.admin_users (
        id uuid PRIMARY KEY,
        email varchar(254) NOT NULL,
        display_name varchar(150) NOT NULL,
        password_hash varchar(255) NOT NULL,
        status varchar(20) NOT NULL,
        failed_login_attempts integer NOT NULL DEFAULT 0,
        locked_until timestamptz NULL,
        last_login_at timestamptz NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT uq_admin_users_email UNIQUE (email),
        CONSTRAINT ck_admin_users_status CHECK (status IN ('ACTIVE', 'SUSPENDED')),
        -- Mirrors Email's Domain invariant (email.ts): normalized (trim+lowercase) form only, and
        -- the same permissive-but-not-empty shape Domain accepts. Domain remains responsible for
        -- normalization; this only rejects what Domain would never have produced.
        CONSTRAINT ck_admin_users_email_lowercase CHECK (email = lower(email)),
        CONSTRAINT ck_admin_users_email_format CHECK (email ~ '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'),
        CONSTRAINT ck_admin_users_email_length CHECK (char_length(email) >= 3),
        -- Mirrors AdminUser's Domain bounds (admin-user.ts's validateDisplayName) - trimmed length
        -- floor only; VARCHAR(150) already bounds the maximum.
        CONSTRAINT ck_admin_users_display_name_length CHECK (char_length(btrim(display_name)) >= 1),
        CONSTRAINT ck_admin_users_failed_login_attempts CHECK (failed_login_attempts >= 0)
      )
    `);

    // --- access_management.admin_sessions -------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE access_management.admin_sessions (
        id uuid PRIMARY KEY,
        admin_user_id uuid NOT NULL,
        refresh_token_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL,
        replaced_by_session_id uuid NULL,
        created_at timestamptz NOT NULL,
        last_used_at timestamptz NOT NULL,
        CONSTRAINT fk_admin_sessions_admin_user_id
          FOREIGN KEY (admin_user_id) REFERENCES access_management.admin_users (id) ON DELETE CASCADE,
        CONSTRAINT fk_admin_sessions_replaced_by_session_id
          FOREIGN KEY (replaced_by_session_id) REFERENCES access_management.admin_sessions (id)
          ON DELETE SET NULL,
        -- Mirrors RefreshTokenGeneratorPort's real implementation (CryptoRefreshTokenGenerator):
        -- a lowercase-hex SHA-256 digest is always exactly 64 hex characters.
        CONSTRAINT ck_admin_sessions_refresh_token_hash_format
          CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_admin_sessions_admin_user_id ON access_management.admin_sessions (admin_user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_admin_sessions_expires_at ON access_management.admin_sessions (expires_at)`,
    );
    // No index on replaced_by_session_id: it is only ever read by following a specific session's
    // own row (already primary-keyed), never filtered/joined on in bulk - see AdminSession's own
    // comment. No separate index on revoked_at: replay/reuse mitigation and rotation both filter by
    // admin_user_id first (idx_admin_sessions_admin_user_id already serves that), and there is no
    // query that filters on revoked_at alone.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS access_management.admin_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS access_management.admin_users`);
    // No CASCADE: if anything other than what this migration created still lives in this schema,
    // DROP SCHEMA fails safely instead of deleting someone else's objects.
    await queryRunner.query(`DROP SCHEMA access_management`);
  }
}
