import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CLOUD-01C-D - Installation Heartbeat / Operational Health.
 *
 * Adds one table to the existing `installations` schema (introduced by CreateControlPlaneCore):
 *   - installations.installation_health - current-state only (no per-heartbeat history), one row
 *     per installation, mirrors application/ports/installation-health-{reader,writer}.port.ts
 *
 * Deliberately NOT a new bounded-context schema (ADR-007 reserved a `health` schema for a possible
 * future general telemetry platform, not consumed here) - this table is 1:1 with Installation, not a
 * cross-cutting concern the way audit is, so it stays inside the existing `installations` schema as
 * a satellite table. See docs/architecture/installation-health.md#data-model.
 *
 * No `status`/`updated_at`/history columns - operational health is always computed at read time from
 * `last_seen_at` (see domain/compute-installation-health.ts), never persisted.
 *
 * NOT executed by this task. The user runs `pnpm migration:run` when ready.
 */
export class CreateInstallationHealth1786580223456 implements MigrationInterface {
  name = "CreateInstallationHealth1786580223456";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE installations.installation_health (
        installation_id     uuid PRIMARY KEY,
        first_seen_at        timestamptz NOT NULL,
        last_seen_at         timestamptz NOT NULL,
        client_reported_at   timestamptz NULL,
        app_version          varchar(50) NOT NULL,
        CONSTRAINT fk_installation_health_installation_id
          FOREIGN KEY (installation_id) REFERENCES installations.installations (id) ON DELETE CASCADE,
        CONSTRAINT ck_installation_health_app_version_not_empty CHECK (char_length(btrim(app_version)) > 0),
        CONSTRAINT ck_installation_health_last_seen_not_before_first_seen CHECK (last_seen_at >= first_seen_at)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS installations.installation_health`);
  }
}
