import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock } from "@pos-cloud/shared-kernel";
import { AdminSessionId } from "../../domain/admin-session-id";
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepository,
} from "../../domain/admin-session-repository.port";

export interface LogoutAdminCommand {
  /** Raw cookie value, if the request had one - `<sessionId>.<secret>`. */
  readonly rawRefreshToken?: string;
}

/**
 * Idempotent from the HTTP caller's perspective: a missing cookie, a malformed token, or an
 * already-revoked/unknown session all resolve as a no-op - see AuthController's 204 response. Never
 * verifies the refresh secret itself; revoking by sessionId alone is sufficient (see
 * docs/architecture/admin-authentication.md#logout).
 */
@Injectable()
export class LogoutAdminUseCase {
  constructor(
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: LogoutAdminCommand): Promise<void> {
    if (!command.rawRefreshToken) {
      return;
    }

    const separatorIndex = command.rawRefreshToken.indexOf(".");
    if (separatorIndex <= 0) {
      return;
    }

    const sessionId = command.rawRefreshToken.slice(0, separatorIndex);
    const session = await this.sessions.findById(AdminSessionId.of(sessionId));
    if (session && !session.isRevoked()) {
      session.revoke(this.clock);
      await this.sessions.save(session);
    }
  }
}
