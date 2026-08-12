import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { PaginatedResult } from "@pos-cloud/shared-kernel";
import { buildPaginatedResult } from "@pos-cloud/shared-kernel";
import { Not, type Repository } from "typeorm";
import { Installation } from "../../domain/installation";
import type { InstallationCode } from "../../domain/installation-code";
import type { InstallationId } from "../../domain/installation-id";
import type {
  InstallationRepository,
  ListInstallationsCriteria,
} from "../../domain/installation-repository.port";
import { InstallationCodeAlreadyExistsError } from "../../domain/installation.errors";
import { InstallationStatus } from "../../domain/installation-status";
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

  async list(criteria: ListInstallationsCriteria): Promise<PaginatedResult<Installation>> {
    const qb = this.repository.createQueryBuilder("installation");

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

    qb.orderBy("installation.created_at", "DESC")
      .skip((criteria.page - 1) * criteria.pageSize)
      .take(criteria.pageSize);

    const [records, total] = await qb.getManyAndCount();

    return buildPaginatedResult(records.map(InstallationMapper.toDomain), total, criteria);
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
