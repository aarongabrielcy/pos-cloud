import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { PaginatedResult } from "@pos-cloud/shared-kernel";
import { buildPaginatedResult } from "@pos-cloud/shared-kernel";
import { Not, type Repository } from "typeorm";
import { Installation } from "../../domain/installation";
import type { InstallationCode } from "../../domain/installation-code";
import type { InstallationId } from "../../domain/installation-id";
import type {
  InstallationListItem,
  InstallationRepository,
  ListInstallationsCriteria,
} from "../../domain/installation-repository.port";
import { InstallationCodeAlreadyExistsError } from "../../domain/installation.errors";
import { InstallationStatus } from "../../domain/installation-status";
import { InstallationHealthRecord } from "./installation-health.record";
import { InstallationMapper } from "./installation.mapper";
import { InstallationRecord } from "./installation.record";

const UNIQUE_VIOLATION = "23505";

@Injectable()
export class TypeOrmInstallationRepository implements InstallationRepository {
  constructor(
    @InjectRepository(InstallationRecord)
    private readonly repository: Repository<InstallationRecord>,
  ) {}

  async findById(id: InstallationId): Promise<Installation | null> {
    const record = await this.repository.findOne({ where: { id: id.toString() } });
    return record ? InstallationMapper.toDomain(record) : null;
  }

  async findByCode(code: InstallationCode): Promise<Installation | null> {
    const record = await this.repository.findOne({ where: { installationCode: code.toString() } });
    return record ? InstallationMapper.toDomain(record) : null;
  }

  async save(installation: Installation): Promise<void> {
    try {
      await this.repository.save(InstallationMapper.toRecord(installation));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new InstallationCodeAlreadyExistsError(installation.installationCode.toString());
      }
      throw error;
    }
  }

  async countNonDecommissionedByLicense(licenseId: string): Promise<number> {
    return this.repository.count({
      where: { licenseId, status: Not(InstallationStatus.DECOMMISSIONED) },
    });
  }

  async list(criteria: ListInstallationsCriteria): Promise<PaginatedResult<InstallationListItem>> {
    // A correlated scalar subquery, not `.leftJoin()`: TypeORM's `getRawAndEntities()` switches to a
    // two-query "find ids in the page, then hydrate" strategy whenever `skip`/`take` is combined with
    // ANY `.leftJoin()` (regardless of whether it targets an entity or a raw table) - see
    // typeorm-installation.repository.spec.ts's "real TypeORM metadata" test for the crash this caused
    // (`createOrderByCombinedWithSelectExpression` reading `.databaseName` off an unresolved column) and
    // docs/architecture/installation-health.md#health-read-api. A subquery in the SELECT list never
    // registers a join attribute, so pagination stays on the plain single-query LIMIT/OFFSET path -
    // genuinely one query per page, not two.
    const qb = this.repository
      .createQueryBuilder("installation")
      .addSelect(
        (subQuery) =>
          subQuery
            .select("health.last_seen_at", "last_seen_at")
            .from(InstallationHealthRecord, "health")
            .where("health.installation_id = installation.id"),
        "last_seen_at",
      );

    if (criteria.customerId) {
      qb.andWhere("installation.customer_id = :customerId", { customerId: criteria.customerId });
    }
    if (criteria.licenseId) {
      qb.andWhere("installation.license_id = :licenseId", { licenseId: criteria.licenseId });
    }
    if (criteria.platform) {
      qb.andWhere("installation.platform = :platform", { platform: criteria.platform });
    }
    if (criteria.status) {
      qb.andWhere("installation.status = :status", { status: criteria.status });
    }
    if (criteria.search) {
      qb.andWhere(
        "(installation.installation_code ILIKE :search OR installation.name ILIKE :search)",
        { search: `%${criteria.search}%` },
      );
    }

    // Counted before pagination is applied (clone leaves `qb` itself untouched).
    const total = await qb.clone().getCount();

    // `installation.createdAt` - the entity's TS property path, not the `created_at` DB column name.
    // TypeORM's plain single-query orderBy path tolerates either (falls back to raw text), but using
    // the DB column name here was already latently wrong and would break again the moment any future
    // `.leftJoin()` reintroduces the two-query paginated path (which resolves order-by columns strictly
    // via `metadata.findColumnWithPropertyPath`, not raw column names).
    qb.orderBy("installation.createdAt", "DESC")
      .skip((criteria.page - 1) * criteria.pageSize)
      .take(criteria.pageSize);

    // A single query for the whole page, entities + the subquery-selected health column together - no
    // N+1, and (unlike a `.leftJoin()`-based approach) never TypeORM's two-query paginated-join path.
    const { entities, raw } = await qb.getRawAndEntities();

    const items: InstallationListItem[] = entities.map((record, index) => ({
      installation: InstallationMapper.toDomain(record),
      lastSeenAt: (raw[index]?.last_seen_at as Date | undefined) ?? null,
    }));

    return buildPaginatedResult(items, total, criteria);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
