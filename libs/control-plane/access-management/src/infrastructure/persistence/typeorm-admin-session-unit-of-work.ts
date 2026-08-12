import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import type {
  AdminSessionTransactionContext,
  AdminSessionUnitOfWork,
} from "../../application/ports/admin-session-unit-of-work.port";
import { AdminSessionMapper } from "./admin-session.mapper";
import { AdminSessionRecord } from "./admin-session.record";

/**
 * Real atomicity for refresh-token rotation: one PostgreSQL transaction per `runExclusive` call,
 * with the target session row locked `SELECT ... FOR UPDATE` (see `findByIdForUpdate` below) so a
 * concurrent second refresh call for the same token blocks on the row lock instead of racing past
 * the read-then-write window - see docs/architecture/admin-authentication.md#refresh-token-rotation.
 * The `sessionId` parameter of `runExclusive` itself is not used for locking directly - locking
 * happens the moment the use case calls `ctx.findByIdForUpdate`, which is always the first thing
 * RefreshAdminSessionUseCase does inside this transaction.
 */
@Injectable()
export class TypeOrmAdminSessionUnitOfWork implements AdminSessionUnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async runExclusive<T>(
    _sessionId: string,
    fn: (ctx: AdminSessionTransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction((manager) => fn(buildContext(manager)));
  }
}

function buildContext(manager: EntityManager): AdminSessionTransactionContext {
  return {
    findByIdForUpdate: async (id) => {
      const record = await manager
        .createQueryBuilder(AdminSessionRecord, "session")
        .setLock("pessimistic_write")
        .where("session.id = :id", { id })
        .getOne();
      return record ? AdminSessionMapper.toDomain(record) : null;
    },
    save: async (session) => {
      await manager.getRepository(AdminSessionRecord).save(AdminSessionMapper.toRecord(session));
    },
    revokeAllActiveForUser: async (adminUserId, revokedAt) => {
      await manager
        .createQueryBuilder()
        .update(AdminSessionRecord)
        .set({ revokedAt })
        .where("admin_user_id = :adminUserId", { adminUserId })
        .andWhere("revoked_at IS NULL")
        .execute();
    },
  };
}
