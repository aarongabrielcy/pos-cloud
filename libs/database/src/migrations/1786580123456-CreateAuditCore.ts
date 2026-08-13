import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CLOUD-01C-D - Audit Base.
 *
 * Creates the `audit` schema (reserved for this purpose since ADR-007) and its single table:
 *   - audit.audit_events - append-only administrative/machine action log, mirrors
 *                           domain/audit-event.ts
 *
 * No FK to any other schema (audit is a cross-cutting write sink every producer bounded context
 * calls into via AuditRecorderPort - see ADR-015 and docs/architecture/audit.md#storage); actor_id/
 * resource_id are plain strings, not FKs, by design (ADR-007: no FK ever crosses a schema
 * boundary).
 *
 * Append-only at the API/application layer (no update/delete endpoint exists anywhere in
 * @pos-cloud/audit) - DB-role-level REVOKE UPDATE/DELETE is a documented backlog hardening item,
 * not enforced by this migration.
 *
 * NOT executed by this task. The user runs `pnpm migration:run` when ready.
 */
export class CreateAuditCore1786580123456 implements MigrationInterface {
  name = "CreateAuditCore1786580123456";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Schema -----------------------------------------------------------------------------
    await queryRunner.query(`CREATE SCHEMA audit`);

    // --- audit.audit_events -------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE audit.audit_events (
        id              uuid PRIMARY KEY,
        occurred_at     timestamptz NOT NULL,
        actor_type      varchar(20) NOT NULL,
        actor_id        varchar(100) NULL,
        action          varchar(100) NOT NULL,
        resource_type   varchar(50) NOT NULL,
        resource_id     varchar(100) NOT NULL,
        correlation_id  varchar(128) NOT NULL,
        metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT ck_audit_events_actor_type CHECK (actor_type IN ('ADMIN', 'INSTALLATION', 'SYSTEM')),
        CONSTRAINT ck_audit_events_action_not_empty CHECK (char_length(btrim(action)) > 0),
        CONSTRAINT ck_audit_events_resource_type_not_empty CHECK (char_length(btrim(resource_type)) > 0),
        CONSTRAINT ck_audit_events_resource_id_not_empty CHECK (char_length(btrim(resource_id)) > 0),
        CONSTRAINT ck_audit_events_correlation_id_not_empty CHECK (char_length(btrim(correlation_id)) > 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX ix_audit_events_occurred_at ON audit.audit_events (occurred_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX ix_audit_events_resource ON audit.audit_events (resource_type, resource_id)
    `);
    await queryRunner.query(`
      CREATE INDEX ix_audit_events_actor ON audit.audit_events (actor_type, actor_id)
    `);
    await queryRunner.query(`
      CREATE INDEX ix_audit_events_action ON audit.audit_events (action)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit.audit_events`);
    // No CASCADE: if anything other than what this migration created still lives in this schema,
    // DROP SCHEMA fails safely instead of deleting someone else's objects.
    await queryRunner.query(`DROP SCHEMA audit`);
  }
}
