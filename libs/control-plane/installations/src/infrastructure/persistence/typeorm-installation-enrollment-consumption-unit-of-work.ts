import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import { IsNull } from "typeorm";
import type {
  InstallationEnrollmentConsumptionContext,
  InstallationEnrollmentConsumptionUnitOfWork,
} from "../../application/ports/installation-enrollment-consumption-unit-of-work.port";
import { InstallationCredentialMapper } from "./installation-credential.mapper";
import { InstallationCredentialRecord } from "./installation-credential.record";
import { InstallationEnrollmentMapper } from "./installation-enrollment.mapper";
import { InstallationEnrollmentRecord } from "./installation-enrollment.record";
import { InstallationMapper } from "./installation.mapper";
import { InstallationRecord } from "./installation.record";

/**
 * See InstallationEnrollmentConsumptionUnitOfWork's own comment for the two-phase, Installation-first
 * locking rationale.
 */
@Injectable()
export class TypeOrmInstallationEnrollmentConsumptionUnitOfWork implements InstallationEnrollmentConsumptionUnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async runExclusive<T>(
    _installationId: string,
    fn: (ctx: InstallationEnrollmentConsumptionContext) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction((manager) => fn(buildContext(manager)));
  }
}

function buildContext(manager: EntityManager): InstallationEnrollmentConsumptionContext {
  return {
    findInstallationForUpdate: async (installationId) => {
      const record = await manager
        .createQueryBuilder(InstallationRecord, "installation")
        .setLock("pessimistic_write")
        .where("installation.id = :installationId", { installationId })
        .getOne();
      return record ? InstallationMapper.toDomain(record) : null;
    },
    findEnrollmentForUpdate: async (enrollmentId) => {
      const record = await manager
        .createQueryBuilder(InstallationEnrollmentRecord, "enrollment")
        .setLock("pessimistic_write")
        .where("enrollment.id = :enrollmentId", { enrollmentId })
        .getOne();
      return record ? InstallationEnrollmentMapper.toDomain(record) : null;
    },
    saveInstallation: async (installation) => {
      await manager.save(InstallationRecord, InstallationMapper.toRecord(installation));
    },
    saveEnrollment: async (enrollment) => {
      await manager.save(
        InstallationEnrollmentRecord,
        InstallationEnrollmentMapper.toRecord(enrollment),
      );
    },
    findActiveCredentialByInstallationId: async (installationId) => {
      const record = await manager.findOne(InstallationCredentialRecord, {
        where: { installationId, revokedAt: IsNull() },
      });
      return record ? InstallationCredentialMapper.toDomain(record) : null;
    },
    saveCredential: async (credential) => {
      await manager.save(
        InstallationCredentialRecord,
        InstallationCredentialMapper.toRecord(credential),
      );
    },
  };
}
