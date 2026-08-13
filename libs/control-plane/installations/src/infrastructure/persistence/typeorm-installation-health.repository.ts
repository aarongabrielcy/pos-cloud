import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DataSource, Repository } from "typeorm";
import type {
  InstallationHealthReaderPort,
  InstallationHealthSnapshot,
} from "../../application/ports/installation-health-reader.port";
import type {
  InstallationHealthWriterPort,
  RecordHeartbeatInput,
} from "../../application/ports/installation-health-writer.port";
import { InstallationHealthMapper } from "./installation-health.mapper";
import { InstallationHealthRecord } from "./installation-health.record";

/**
 * `recordHeartbeat` is one atomic `INSERT ... ON CONFLICT DO UPDATE` (raw SQL - TypeORM's
 * Repository/QueryBuilder API cannot express the required per-column CASE WHEN semantics), never a
 * read-then-write. `last_seen_at` uses GREATEST so it can never regress under concurrent/reordered
 * heartbeats; `app_version`/`client_reported_at` follow the SAME winning row (the one whose
 * receivedAt is newest), not independently - a heartbeat that finishes later but was sent earlier
 * must never overwrite fresher data with stale data. `first_seen_at` is intentionally absent from
 * the UPDATE SET clause, so it is set once by the initial INSERT and never touched again. See
 * docs/architecture/installation-health.md#concurrency.
 */
@Injectable()
export class TypeOrmInstallationHealthRepository
  implements InstallationHealthWriterPort, InstallationHealthReaderPort
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(InstallationHealthRecord)
    private readonly repository: Repository<InstallationHealthRecord>,
  ) {}

  async recordHeartbeat(input: RecordHeartbeatInput): Promise<void> {
    await this.dataSource.query(
      `
        INSERT INTO installations.installation_health
          (installation_id, first_seen_at, last_seen_at, client_reported_at, app_version)
        VALUES ($1, $2, $2, $3, $4)
        ON CONFLICT (installation_id) DO UPDATE SET
          last_seen_at = GREATEST(installation_health.last_seen_at, EXCLUDED.last_seen_at),
          app_version = CASE
            WHEN EXCLUDED.last_seen_at >= installation_health.last_seen_at
            THEN EXCLUDED.app_version
            ELSE installation_health.app_version
          END,
          client_reported_at = CASE
            WHEN EXCLUDED.last_seen_at >= installation_health.last_seen_at
            THEN EXCLUDED.client_reported_at
            ELSE installation_health.client_reported_at
          END
      `,
      [input.installationId, input.receivedAt, input.clientReportedAt, input.appVersion],
    );
  }

  async findByInstallationId(installationId: string): Promise<InstallationHealthSnapshot | null> {
    const record = await this.repository.findOne({ where: { installationId } });
    return record ? InstallationHealthMapper.toSnapshot(record) : null;
  }
}
