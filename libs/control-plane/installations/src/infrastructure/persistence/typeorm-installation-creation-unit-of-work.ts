import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import { Not } from "typeorm";
import type {
  InstallationCreationContext,
  InstallationCreationUnitOfWork,
} from "../../application/ports/installation-creation-unit-of-work.port";
import type { Installation } from "../../domain/installation";
import type { InstallationCode } from "../../domain/installation-code";
import { InstallationCodeAlreadyExistsError } from "../../domain/installation.errors";
import { InstallationStatus } from "../../domain/installation-status";
import { InstallationMapper } from "./installation.mapper";
import { InstallationRecord } from "./installation.record";

const UNIQUE_VIOLATION = "23505";

/** See InstallationCreationUnitOfWork's own comment for the full locking rationale. */
@Injectable()
export class TypeOrmInstallationCreationUnitOfWork implements InstallationCreationUnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async runExclusiveForLicense<T>(
    licenseId: string,
    fn: (ctx: InstallationCreationContext) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      // Transaction-scoped Postgres advisory lock keyed on licenseId - blocks a second concurrent
      // transaction attempting the SAME key until this one commits or rolls back (both happen
      // automatically at the end of dataSource.transaction's callback). hashtextextended(..., 0)
      // gives a full 64-bit key (vs. hashtext's 32-bit), minimizing - never fully eliminating - a
      // hash-collision-driven false serialization between two unrelated licenses, which is only ever
      // a performance concern, never a correctness one (a spurious wait, not a spurious pass).
      await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [licenseId]);
      return fn(buildContext(manager));
    });
  }
}

function buildContext(manager: EntityManager): InstallationCreationContext {
  return {
    countNonDecommissionedByLicense: (licenseId) =>
      manager.count(InstallationRecord, {
        where: { licenseId, status: Not(InstallationStatus.DECOMMISSIONED) },
      }),
    findInstallationByCode: async (code: InstallationCode) => {
      const record = await manager.findOne(InstallationRecord, {
        where: { installationCode: code.toString() },
      });
      return record ? InstallationMapper.toDomain(record) : null;
    },
    saveInstallation: async (installation: Installation) => {
      try {
        await manager.save(InstallationRecord, InstallationMapper.toRecord(installation));
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new InstallationCodeAlreadyExistsError(installation.installationCode.toString());
        }
        throw error;
      }
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
