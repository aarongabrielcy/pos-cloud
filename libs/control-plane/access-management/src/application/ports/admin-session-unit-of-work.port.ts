import type { AdminSession } from "../../domain/admin-session";

/**
 * Transactional context bound (by Infrastructure) to one atomic PostgreSQL transaction with the
 * target session row locked `FOR UPDATE`. Application code never sees TypeORM here - only this
 * plain interface (see docs/architecture/admin-authentication.md#refresh-token-rotation and
 * infrastructure/persistence/typeorm-admin-session-unit-of-work.ts for the implementation).
 */
export interface AdminSessionTransactionContext {
  findByIdForUpdate(id: string): Promise<AdminSession | null>;
  save(session: AdminSession): Promise<void>;
  /** Bulk-revokes every currently-active session for a user - used by replay/reuse mitigation. */
  revokeAllActiveForUser(adminUserId: string, revokedAt: Date): Promise<void>;
}

/**
 * Runs `fn` inside one atomic transaction scoped to `sessionId`, so a concurrent double-refresh of
 * the same token cannot race past the read-then-write window (see RefreshAdminSessionUseCase and
 * CLOUD-01C-A brief section 32/33).
 */
export interface AdminSessionUnitOfWork {
  runExclusive<T>(
    sessionId: string,
    fn: (ctx: AdminSessionTransactionContext) => Promise<T>,
  ): Promise<T>;
}

export const ADMIN_SESSION_UNIT_OF_WORK = Symbol("ADMIN_SESSION_UNIT_OF_WORK");
