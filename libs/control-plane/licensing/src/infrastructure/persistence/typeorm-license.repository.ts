import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { PaginatedResult } from "@pos-cloud/shared-kernel";
import { buildPaginatedResult } from "@pos-cloud/shared-kernel";
import { In, type Repository } from "typeorm";
import { License } from "../../domain/license";
import type { LicenseId } from "../../domain/license-id";
import type { LicenseNumber } from "../../domain/license-number";
import type { LicenseRepository, ListLicensesCriteria } from "../../domain/license-repository.port";
import { LicenseNumberAlreadyExistsError } from "../../domain/license.errors";
import { LicenseEntitlementMapper, LicenseMapper } from "./license.mapper";
import { LicenseEntitlementRecord, LicenseRecord } from "./license.record";

const UNIQUE_VIOLATION = "23505";

@Injectable()
export class TypeOrmLicenseRepository implements LicenseRepository {
  constructor(
    @InjectRepository(LicenseRecord) private readonly licenseRepo: Repository<LicenseRecord>,
    @InjectRepository(LicenseEntitlementRecord)
    private readonly entitlementRepo: Repository<LicenseEntitlementRecord>,
  ) {}

  async findById(id: LicenseId): Promise<License | null> {
    const record = await this.licenseRepo.findOne({ where: { id: id.toString() } });
    if (!record) {
      return null;
    }
    const entitlements = await this.entitlementRepo.find({ where: { licenseId: record.id } });
    return LicenseMapper.toDomain(record, entitlements);
  }

  async findByLicenseNumber(licenseNumber: LicenseNumber): Promise<License | null> {
    const record = await this.licenseRepo.findOne({
      where: { licenseNumber: licenseNumber.toString() },
    });
    if (!record) {
      return null;
    }
    const entitlements = await this.entitlementRepo.find({ where: { licenseId: record.id } });
    return LicenseMapper.toDomain(record, entitlements);
  }

  /** Persists the License row and its full entitlement set in one transaction. */
  async save(license: License): Promise<void> {
    try {
      await this.licenseRepo.manager.transaction(async (manager) => {
        await manager.save(LicenseRecord, LicenseMapper.toRecord(license));
        if (license.entitlements.length > 0) {
          await manager.save(
            LicenseEntitlementRecord,
            license.entitlements.map(LicenseEntitlementMapper.toRecord),
          );
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new LicenseNumberAlreadyExistsError(license.licenseNumber.toString());
      }
      throw error;
    }
  }

  /** Delete-all-then-insert the entitlement collection, plus the License's bumped updatedAt, atomically. */
  async replaceEntitlements(license: License): Promise<void> {
    await this.licenseRepo.manager.transaction(async (manager) => {
      await manager.delete(LicenseEntitlementRecord, { licenseId: license.id.toString() });
      if (license.entitlements.length > 0) {
        await manager.save(
          LicenseEntitlementRecord,
          license.entitlements.map(LicenseEntitlementMapper.toRecord),
        );
      }
      await manager.save(LicenseRecord, LicenseMapper.toRecord(license));
    });
  }

  /** Batched, entitlement-free read - same "list views omit entitlements" principle as list(). */
  async findByIds(ids: readonly string[]): Promise<License[]> {
    if (ids.length === 0) {
      return [];
    }
    const records = await this.licenseRepo.find({ where: { id: In([...ids]) } });
    return records.map((record) => LicenseMapper.toDomain(record));
  }

  /** List views intentionally omit entitlements (heavy, jsonb configuration) - see docs. */
  async list(criteria: ListLicensesCriteria): Promise<PaginatedResult<License>> {
    const qb = this.licenseRepo.createQueryBuilder("license");

    if (criteria.customerId) {
      qb.andWhere("license.customer_id = :customerId", { customerId: criteria.customerId });
    }
    if (criteria.status) {
      qb.andWhere("license.status = :status", { status: criteria.status });
    }
    if (criteria.edition) {
      qb.andWhere("license.edition = :edition", { edition: criteria.edition });
    }
    if (criteria.search) {
      qb.andWhere("license.license_number ILIKE :search", { search: `%${criteria.search}%` });
    }

    qb.orderBy("license.created_at", "DESC")
      .skip((criteria.page - 1) * criteria.pageSize)
      .take(criteria.pageSize);

    const [records, total] = await qb.getManyAndCount();

    return buildPaginatedResult(
      records.map((record) => LicenseMapper.toDomain(record)),
      total,
      criteria,
    );
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
