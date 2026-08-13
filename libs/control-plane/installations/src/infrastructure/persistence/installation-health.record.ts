import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * TypeORM persistence record for `installations.installation_health` - current-state only, one row
 * per installation, no heartbeat history (see docs/architecture/installation-health.md#data-model).
 * Used for reads only (`@InjectRepository`); the write side
 * (TypeOrmInstallationHealthRepository.recordHeartbeat) uses a raw parameterized upsert instead,
 * since the required "latest receivedAt wins per column" semantics cannot be expressed through the
 * Repository API.
 */
@Entity({ name: "installation_health", schema: "installations" })
export class InstallationHealthRecord {
  @PrimaryColumn({ name: "installation_id", type: "uuid" })
  installationId!: string;

  @Column({ name: "first_seen_at", type: "timestamptz" })
  firstSeenAt!: Date;

  @Column({ name: "last_seen_at", type: "timestamptz" })
  lastSeenAt!: Date;

  @Column({ name: "client_reported_at", type: "timestamptz", nullable: true })
  clientReportedAt!: Date | null;

  @Column({ name: "app_version", type: "varchar", length: 50 })
  appVersion!: string;
}
