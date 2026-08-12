import { AdminSession } from "../domain/admin-session";
import type { AdminSessionId } from "../domain/admin-session-id";
import type { AdminSessionRepository } from "../domain/admin-session-repository.port";
import type {
  AdminSessionTransactionContext,
  AdminSessionUnitOfWork,
} from "../application/ports/admin-session-unit-of-work.port";

/**
 * A single in-memory session map backing both AdminSessionRepository and AdminSessionUnitOfWork
 * test doubles, so a test can create a session via one and rotate it via the other exactly like
 * production code does (LoginAdminUseCase uses the plain repository; RefreshAdminSessionUseCase
 * uses the unit of work). Never used in production code - real atomicity is PostgreSQL's `FOR
 * UPDATE`, not simulated here (tests are single-threaded, so no lock is needed to prove call
 * ordering).
 *
 * `runExclusive` models real transactional commit/rollback, not just call ordering: a real
 * PostgreSQL transaction (TypeOrmAdminSessionUnitOfWork -> dataSource.transaction()) discards every
 * mutation made inside the callback if it throws - a prior version of this fake mutated `byId`
 * directly and unconditionally, which could not detect a real production bug where a defensive
 * mass-revocation was rolled back because the rejecting error was thrown before the transaction
 * committed (see RefreshAdminSessionUseCase's own comment). Every session is cloned into a working
 * copy for the duration of the callback; `byId` is only replaced with that working copy if the
 * callback resolves without throwing, exactly like COMMIT vs. ROLLBACK.
 */
export class InMemoryAdminSessionStore implements AdminSessionRepository, AdminSessionUnitOfWork {
  private byId = new Map<string, AdminSession>();

  async findById(id: AdminSessionId): Promise<AdminSession | null> {
    return this.byId.get(id.toString()) ?? null;
  }

  async save(session: AdminSession): Promise<void> {
    this.byId.set(session.id.toString(), session);
  }

  async runExclusive<T>(
    _sessionId: string,
    fn: (ctx: AdminSessionTransactionContext) => Promise<T>,
  ): Promise<T> {
    const working = new Map<string, AdminSession>();
    for (const [id, session] of this.byId) {
      working.set(id, cloneSession(session));
    }

    const ctx: AdminSessionTransactionContext = {
      findByIdForUpdate: async (id) => working.get(id) ?? null,
      save: async (session) => {
        working.set(session.id.toString(), session);
      },
      revokeAllActiveForUser: async (adminUserId, revokedAt) => {
        for (const session of working.values()) {
          if (session.adminUserId === adminUserId && !session.isRevoked()) {
            session.revoke({ now: () => revokedAt });
          }
        }
      },
    };

    // If `fn` throws, this rejects and the assignment below is never reached - `byId` is left
    // exactly as it was before this call, i.e. rolled back.
    const result = await fn(ctx);
    this.byId = working; // commit
    return result;
  }
}

function cloneSession(session: AdminSession): AdminSession {
  return AdminSession.reconstitute({
    id: session.id,
    adminUserId: session.adminUserId,
    refreshTokenHash: session.refreshTokenHash,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    replacedBySessionId: session.replacedBySessionId,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
  });
}
