import { Inject, Injectable } from "@nestjs/common";
import { AUTH_CONFIG, type AuthConfig } from "@pos-cloud/config";
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from "@pos-cloud/shared-kernel";
import { AdminSession } from "../../domain/admin-session";
import { AdminSessionId } from "../../domain/admin-session-id";
import { InvalidRefreshTokenError } from "../../domain/admin-session.errors";
import { ACCESS_TOKEN_ISSUER, type AccessTokenIssuerPort } from "../ports/access-token.port";
import {
  ADMIN_SESSION_UNIT_OF_WORK,
  type AdminSessionUnitOfWork,
} from "../ports/admin-session-unit-of-work.port";
import {
  REFRESH_TOKEN_GENERATOR,
  type RefreshTokenGeneratorPort,
} from "../ports/refresh-token-generator.port";

export interface RefreshAdminSessionCommand {
  /** Raw cookie value: `<sessionId>.<secret>`. */
  readonly rawRefreshToken: string;
}

export interface RefreshAdminSessionResult {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly refreshToken: { readonly sessionId: string; readonly secret: string };
}

/**
 * Discriminates the two ways the transactional callback can end: a legitimate rotation (carries the
 * new tokens), or a detected replay (the mass revocation already happened inside the transaction -
 * the caller only needs to know to reject the request once the transaction has committed).
 */
type RefreshTransactionOutcome =
  ({ readonly kind: "rotated" } & RefreshAdminSessionResult) | { readonly kind: "replayDetected" };

/**
 * Rotates a refresh token atomically (see AdminSessionUnitOfWork). Every rejection path ultimately
 * throws the same InvalidRefreshTokenError (401 INVALID_REFRESH_TOKEN) - malformed token, unknown
 * session, hash mismatch, expired, or revoked/replayed - see docs/architecture/
 * admin-authentication.md#refresh-token-rotation.
 *
 * Replay/reuse mitigation: a session is only ever revoked by this use case as part of rotation (see
 * `session.revoke` below) or as part of the mass-revocation branch here. If a request presents a
 * secret that hashes to a session's stored hash AND that session is already revoked, the presented
 * secret is provably the genuine old token being replayed (not a guess - the hash matched) - every
 * other active session for that AdminUser is revoked in response. A hash mismatch alone (wrong
 * secret against a live session) is treated as an ordinary invalid token, not a replay signal.
 *
 * Critical: the replay branch below returns `{ kind: "replayDetected" }` instead of throwing inside
 * the transactional callback. `unitOfWork.runExclusive` wraps a real PostgreSQL transaction
 * (TypeOrmAdminSessionUnitOfWork -> dataSource.transaction()) - throwing inside that callback rolls
 * back every mutation made during it, including the mass revocation we just performed, which would
 * silently undo the defensive measure while still returning 401 (a real incident: the revocation
 * never persisted because InvalidRefreshTokenError used to be thrown before the transaction
 * committed). InvalidRefreshTokenError is thrown only after `runExclusive` resolves, i.e. after
 * COMMIT - see refresh-admin-session.use-case.spec.ts for the regression test.
 */
@Injectable()
export class RefreshAdminSessionUseCase {
  constructor(
    @Inject(ADMIN_SESSION_UNIT_OF_WORK) private readonly unitOfWork: AdminSessionUnitOfWork,
    @Inject(REFRESH_TOKEN_GENERATOR)
    private readonly refreshTokenGenerator: RefreshTokenGeneratorPort,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly accessTokenIssuer: AccessTokenIssuerPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  async execute(command: RefreshAdminSessionCommand): Promise<RefreshAdminSessionResult> {
    const { sessionId, secret } = parseRawRefreshToken(command.rawRefreshToken);

    const outcome = await this.unitOfWork.runExclusive(
      sessionId,
      async (ctx): Promise<RefreshTransactionOutcome> => {
        const session = await ctx.findByIdForUpdate(sessionId);
        if (!session) {
          throw new InvalidRefreshTokenError();
        }

        // Secret is verified BEFORE any replay/reuse decision - knowing a sessionId alone (without
        // the matching secret) must never be able to trigger the mass-revocation branch below.
        const presentedHash = this.refreshTokenGenerator.hashSecret(secret);
        if (presentedHash !== session.refreshTokenHash) {
          throw new InvalidRefreshTokenError();
        }

        if (session.isRevoked()) {
          await ctx.revokeAllActiveForUser(session.adminUserId, this.clock.now());
          return { kind: "replayDetected" };
        }

        const now = this.clock.now();
        if (session.isExpired(now)) {
          throw new InvalidRefreshTokenError();
        }

        const newSessionId = this.idGenerator.next();
        const newSecret = this.refreshTokenGenerator.generateSecret();
        const newRefreshTokenHash = this.refreshTokenGenerator.hashSecret(newSecret);
        const newExpiresAt = new Date(
          now.getTime() + this.authConfig.refreshTokenTtlSeconds * 1000,
        );

        const newSession = AdminSession.create(
          {
            id: newSessionId,
            adminUserId: session.adminUserId,
            refreshTokenHash: newRefreshTokenHash,
            expiresAt: newExpiresAt,
          },
          this.clock,
        );
        session.revoke(this.clock, AdminSessionId.of(newSessionId));

        // Order matters: the old row's replaced_by_session_id FK (fk_admin_sessions_replaced_by_
        // session_id) references the new row, so the new session must exist before the old one is
        // updated to point at it - saving old-then-new violates that FK (see
        // typeorm-admin-session-unit-of-work.spec.ts for the regression test).
        await ctx.save(newSession);
        await ctx.save(session);

        const issued = await this.accessTokenIssuer.issue({
          sub: session.adminUserId,
          sid: newSessionId,
        });

        return {
          kind: "rotated",
          accessToken: issued.token,
          expiresInSeconds: issued.expiresInSeconds,
          refreshToken: { sessionId: newSessionId, secret: newSecret },
        };
      },
    );

    if (outcome.kind === "replayDetected") {
      // Thrown here, outside runExclusive - the transaction has already committed the mass
      // revocation, so this rejection cannot roll it back.
      throw new InvalidRefreshTokenError();
    }

    return {
      accessToken: outcome.accessToken,
      expiresInSeconds: outcome.expiresInSeconds,
      refreshToken: outcome.refreshToken,
    };
  }
}

function parseRawRefreshToken(raw: string): { sessionId: string; secret: string } {
  const separatorIndex = raw.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) {
    throw new InvalidRefreshTokenError();
  }
  return { sessionId: raw.slice(0, separatorIndex), secret: raw.slice(separatorIndex + 1) };
}
