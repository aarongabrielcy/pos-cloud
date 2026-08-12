import type { AuthConfig } from "@pos-cloud/config";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import type { DataSource, EntityManager } from "typeorm";
import { RefreshAdminSessionUseCase } from "../../application/use-cases/refresh-admin-session.use-case";
import { AdminSession } from "../../domain/admin-session";
import { AdminSessionId } from "../../domain/admin-session-id";
import { FakeAccessTokenIssuer } from "../../test-support/fake-access-token-issuer";
import { FakeRefreshTokenGenerator } from "../../test-support/fake-refresh-token-generator";
import { FixedClock } from "../../test-support/fixed-clock";
import { AdminSessionMapper } from "./admin-session.mapper";
import { AdminSessionRecord } from "./admin-session.record";
import { TypeOrmAdminSessionUnitOfWork } from "./typeorm-admin-session-unit-of-work";

/**
 * Regression tests for two real production incidents against the real TypeOrmAdminSessionUnitOfWork
 * (not a Domain-level or plain in-memory fake - see each incident below for why those cannot detect
 * these bugs), using a fake EntityManager/DataSource that mirrors the two PostgreSQL behaviors that
 * actually caused them:
 *
 * 1. (correlation id 61dea442-f01a-4785-8a86-c9e1ea96ed14) The old session was saved with
 *    replaced_by_session_id pointing at the new session's id BEFORE the new session row existed,
 *    violating fk_admin_sessions_replaced_by_session_id (Postgres 23503) - see
 *    FkEnforcingSessionTable.save.
 * 2. A replay was correctly detected and every other active session was revoked, but
 *    InvalidRefreshTokenError was thrown INSIDE unitOfWork.runExclusive's callback, which wraps a
 *    real `dataSource.transaction()` - PostgreSQL rolled back every mutation made during that
 *    callback, including the revocation, so nothing persisted despite the 401 - see
 *    buildFakeDataSource's `transaction` and the "replay" test below.
 *
 * No real Postgres/testcontainers infrastructure exists anywhere in this repo yet, and building one
 * just for this would be a large, disproportionate addition (see CLOUD-01C-A corrections history) -
 * so this fake EntityManager/DataSource models exactly the two behaviors above (FK enforcement,
 * transactional snapshot/commit/rollback) instead, which is enough to make both regressions fail
 * loudly if reintroduced without needing a real database.
 */
class FkEnforcingSessionTable {
  private rows = new Map<string, AdminSessionRecord>();
  readonly saveOrder: string[] = [];

  save(record: AdminSessionRecord): AdminSessionRecord {
    if (record.replacedBySessionId && !this.rows.has(record.replacedBySessionId)) {
      throw new Error(
        'insert or update on table "admin_sessions" violates foreign key constraint ' +
          '"fk_admin_sessions_replaced_by_session_id"',
      );
    }
    this.rows.set(record.id, record);
    this.saveOrder.push(record.id);
    return record;
  }

  findById(id: string): AdminSessionRecord | undefined {
    return this.rows.get(id);
  }

  /** Mirrors the real `UPDATE ... WHERE admin_user_id = :adminUserId AND revoked_at IS NULL`. */
  updateActiveForUser(adminUserId: string, setValues: Partial<AdminSessionRecord>): number {
    let affected = 0;
    for (const record of this.rows.values()) {
      if (record.adminUserId === adminUserId && record.revokedAt === null) {
        Object.assign(record, setValues);
        affected++;
      }
    }
    return affected;
  }

  /** Deep-clones every row (mutations like updateActiveForUser's Object.assign happen in place). */
  snapshot(): Map<string, AdminSessionRecord> {
    const copy = new Map<string, AdminSessionRecord>();
    for (const [id, record] of this.rows) {
      copy.set(id, Object.assign(new AdminSessionRecord(), record));
    }
    return copy;
  }

  restore(snapshot: Map<string, AdminSessionRecord>): void {
    this.rows = snapshot;
  }
}

function buildFakeManager(table: FkEnforcingSessionTable): EntityManager {
  function buildSelectQueryBuilder() {
    let targetId: string | undefined;
    const qb = {
      setLock: () => qb,
      where: (_condition: string, params?: { id?: string }) => {
        targetId = params?.id;
        return qb;
      },
      getOne: async () => (targetId ? (table.findById(targetId) ?? null) : null),
    };
    return qb;
  }

  function buildUpdateQueryBuilder() {
    let setValues: Partial<AdminSessionRecord> = {};
    let targetAdminUserId: string | undefined;
    const qb = {
      update: () => qb,
      set: (values: Partial<AdminSessionRecord>) => {
        setValues = values;
        return qb;
      },
      where: (_condition: string, params?: { adminUserId?: string }) => {
        targetAdminUserId = params?.adminUserId;
        return qb;
      },
      andWhere: () => qb,
      execute: async () => {
        const affected = targetAdminUserId
          ? table.updateActiveForUser(targetAdminUserId, setValues)
          : 0;
        return { affected, raw: [], generatedMaps: [] };
      },
    };
    return qb;
  }

  return {
    // findByIdForUpdate calls createQueryBuilder(AdminSessionRecord, "session") (2 args);
    // revokeAllActiveForUser calls createQueryBuilder() (0 args) - see
    // typeorm-admin-session-unit-of-work.ts's buildContext for both call sites.
    createQueryBuilder: (...args: unknown[]) =>
      args.length > 0 ? buildSelectQueryBuilder() : buildUpdateQueryBuilder(),
    getRepository: () => ({
      save: async (record: AdminSessionRecord) => table.save(record),
    }),
  } as unknown as EntityManager;
}

function buildFakeDataSource(table: FkEnforcingSessionTable): DataSource {
  const manager = buildFakeManager(table);
  return {
    transaction: async <T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> => {
      const snapshot = table.snapshot();
      try {
        return await fn(manager);
      } catch (error) {
        table.restore(snapshot); // ROLLBACK: discard every mutation made during this callback
        throw error;
      }
      // No explicit commit step needed: if `fn` resolves, the table's mutations are simply kept.
    },
  } as unknown as DataSource;
}

const authConfig: AuthConfig = {
  jwt: { secret: "s".repeat(64), issuer: "pos-cloud", audience: "pos-cloud-admin" },
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  refreshCookieName: "pos_cloud_admin_refresh",
  secureCookies: false,
};

function buildSession(
  input: { id: string; adminUserId: string; refreshTokenHash: string },
  clock: FixedClock,
): AdminSession {
  return AdminSession.create(
    {
      ...input,
      expiresAt: new Date(clock.now().getTime() + authConfig.refreshTokenTtlSeconds * 1000),
    },
    clock,
  );
}

describe("TypeOrmAdminSessionUnitOfWork - refresh rotation FK order", () => {
  it("sanity check: the fake table rejects an update that references a not-yet-existing row (proves it actually simulates the Postgres FK)", () => {
    const table = new FkEnforcingSessionTable();
    const existingId = "11111111-1111-4111-8111-111111111111";
    const notYetSavedId = "22222222-2222-4222-8222-222222222222";
    table.save(
      Object.assign(new AdminSessionRecord(), { id: existingId, replacedBySessionId: null }),
    );

    expect(() =>
      table.save(
        Object.assign(new AdminSessionRecord(), {
          id: existingId,
          replacedBySessionId: notYetSavedId,
        }),
      ),
    ).toThrow(/fk_admin_sessions_replaced_by_session_id/);
  });

  it("rotates a session through the real UnitOfWork without violating the replaced_by_session_id FK", async () => {
    const table = new FkEnforcingSessionTable();
    const unitOfWork = new TypeOrmAdminSessionUnitOfWork(buildFakeDataSource(table));
    const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
    const refreshGenerator = new FakeRefreshTokenGenerator();
    const idGenerator = new RandomUuidGenerator();
    const adminUserId = idGenerator.next();
    const sessionId = idGenerator.next();
    const secret = refreshGenerator.generateSecret();

    const session = buildSession(
      { id: sessionId, adminUserId, refreshTokenHash: refreshGenerator.hashSecret(secret) },
      clock,
    );
    table.save(AdminSessionMapper.toRecord(session));
    table.saveOrder.length = 0; // only track saves made by the rotation itself, not this setup save

    const useCase = new RefreshAdminSessionUseCase(
      unitOfWork,
      refreshGenerator,
      new FakeAccessTokenIssuer(),
      clock,
      idGenerator,
      authConfig,
    );

    const result = await useCase.execute({ rawRefreshToken: `${sessionId}.${secret}` });

    // Explicit order assertion: the new session's INSERT must reach the fake table before the old
    // session's UPDATE (which carries the FK-bearing replaced_by_session_id) - reversing this order
    // is exactly what table.save() would reject, as proven by the sanity-check test above.
    expect(table.saveOrder).toEqual([result.refreshToken.sessionId, sessionId]);

    const oldRecord = table.findById(sessionId);
    expect(oldRecord?.revokedAt).not.toBeNull();
    expect(oldRecord?.replacedBySessionId).toBe(result.refreshToken.sessionId);

    const newRecord = table.findById(result.refreshToken.sessionId);
    expect(newRecord).toBeDefined();
    expect(newRecord?.replacedBySessionId).toBeNull();
  });

  it("keeps the old session's replacedBySessionId chain intact after rotation (readable back via the mapper)", async () => {
    const table = new FkEnforcingSessionTable();
    const unitOfWork = new TypeOrmAdminSessionUnitOfWork(buildFakeDataSource(table));
    const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
    const refreshGenerator = new FakeRefreshTokenGenerator();
    const idGenerator = new RandomUuidGenerator();
    const adminUserId = idGenerator.next();
    const sessionId = idGenerator.next();
    const secret = refreshGenerator.generateSecret();

    const session = buildSession(
      { id: sessionId, adminUserId, refreshTokenHash: refreshGenerator.hashSecret(secret) },
      clock,
    );
    table.save(AdminSessionMapper.toRecord(session));

    const useCase = new RefreshAdminSessionUseCase(
      unitOfWork,
      refreshGenerator,
      new FakeAccessTokenIssuer(),
      clock,
      idGenerator,
      authConfig,
    );
    const result = await useCase.execute({ rawRefreshToken: `${sessionId}.${secret}` });

    const oldRecord = table.findById(sessionId);
    const rehydrated = AdminSessionMapper.toDomain(oldRecord!);
    expect(rehydrated.isRevoked()).toBe(true);
    expect(
      rehydrated.replacedBySessionId?.equals(AdminSessionId.of(result.refreshToken.sessionId)),
    ).toBe(true);
  });
});

describe("TypeOrmAdminSessionUnitOfWork - replay mass-revocation must survive commit", () => {
  it("sanity check: the fake DataSource rolls back every mutation if the transaction callback throws (proves it actually simulates Postgres ROLLBACK)", async () => {
    const table = new FkEnforcingSessionTable();
    const dataSource = buildFakeDataSource(table);
    const adminUserId = "33333333-3333-4333-8333-333333333333";
    const sessionId = "44444444-4444-4444-8444-444444444444";
    table.save(
      Object.assign(new AdminSessionRecord(), { id: sessionId, adminUserId, revokedAt: null }),
    );

    await expect(
      dataSource.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .update(AdminSessionRecord)
          .set({ revokedAt: new Date("2026-01-01T00:00:00.000Z") })
          .where("admin_user_id = :adminUserId", { adminUserId })
          .andWhere("revoked_at IS NULL")
          .execute();
        throw new Error("boom - simulates InvalidRefreshTokenError thrown too early");
      }),
    ).rejects.toThrow("boom");

    // The revocation made inside the callback must NOT have survived the throw.
    expect(table.findById(sessionId)?.revokedAt).toBeNull();
  });

  it("persists the mass revocation of every other active session even though the replay itself is rejected (regression for the incident where the revocation was rolled back)", async () => {
    const table = new FkEnforcingSessionTable();
    const unitOfWork = new TypeOrmAdminSessionUnitOfWork(buildFakeDataSource(table));
    const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
    const refreshGenerator = new FakeRefreshTokenGenerator();
    const idGenerator = new RandomUuidGenerator();
    const adminUserId = idGenerator.next();
    const sessionId = idGenerator.next();
    const secret = refreshGenerator.generateSecret();

    const session = buildSession(
      { id: sessionId, adminUserId, refreshTokenHash: refreshGenerator.hashSecret(secret) },
      clock,
    );
    table.save(AdminSessionMapper.toRecord(session));

    // A second, unrelated active session for the same admin user.
    const otherSecret = refreshGenerator.generateSecret();
    const otherSessionId = idGenerator.next();
    const otherSession = buildSession(
      {
        id: otherSessionId,
        adminUserId,
        refreshTokenHash: refreshGenerator.hashSecret(otherSecret),
      },
      clock,
    );
    table.save(AdminSessionMapper.toRecord(otherSession));

    const useCase = new RefreshAdminSessionUseCase(
      unitOfWork,
      refreshGenerator,
      new FakeAccessTokenIssuer(),
      clock,
      idGenerator,
      authConfig,
    );

    // Legitimate rotation.
    const first = await useCase.execute({ rawRefreshToken: `${sessionId}.${secret}` });

    // Replay of the now-revoked original token - must be rejected...
    await expect(useCase.execute({ rawRefreshToken: `${sessionId}.${secret}` })).rejects.toThrow(
      /INVALID_REFRESH_TOKEN|Invalid or expired refresh token/,
    );

    // ...but the mass revocation triggered by that replay must have committed regardless.
    expect(table.findById(otherSessionId)?.revokedAt).not.toBeNull();
    expect(table.findById(first.refreshToken.sessionId)?.revokedAt).not.toBeNull();
  });
});
