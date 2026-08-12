import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import { IsNull } from "typeorm";
import type {
  InstallationEnrollmentIssuanceContext,
  InstallationEnrollmentIssuanceUnitOfWork,
} from "../../application/ports/installation-enrollment-issuance-unit-of-work.port";
import { InstallationMapper } from "./installation.mapper";
import { InstallationRecord } from "./installation.record";
import { InstallationEnrollmentMapper } from "./installation-enrollment.mapper";
import { InstallationEnrollmentRecord } from "./installation-enrollment.record";

/**
 * See InstallationEnrollmentIssuanceUnitOfWork's own comment for the locking rationale
 * (Installation-first, to keep lock order consistent with the consumption unit-of-work below).
 */
@Injectable()
export class TypeOrmInstallationEnrollmentIssuanceUnitOfWork implements InstallationEnrollmentIssuanceUnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async runExclusive<T>(
    _installationId: string,
    fn: (ctx: InstallationEnrollmentIssuanceContext) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction((manager) => fn(buildContext(manager)));
  }
}

function buildContext(manager: EntityManager): InstallationEnrollmentIssuanceContext {
  return {
    findInstallationForUpdate: async (installationId) => {
      const record = await manager
        .createQueryBuilder(InstallationRecord, "installation")
        .setLock("pessimistic_write")
        .where("installation.id = :installationId", { installationId })
        .getOne();
      return record ? InstallationMapper.toDomain(record) : null;
    },
    findOpenEnrollmentByInstallationId: async (installationId) => {
      const record = await manager.findOne(InstallationEnrollmentRecord, {
        where: { installationId, consumedAt: IsNull(), revokedAt: IsNull() },
      });
      return record ? InstallationEnrollmentMapper.toDomain(record) : null;
    },
    saveEnrollment: async (enrollment) => {
      await manager.save(
        InstallationEnrollmentRecord,
        InstallationEnrollmentMapper.toRecord(enrollment),
      );
    },
  };
}
