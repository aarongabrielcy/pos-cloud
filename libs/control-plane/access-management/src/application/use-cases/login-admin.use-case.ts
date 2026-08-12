import { Inject, Injectable } from "@nestjs/common";
import { AUTH_CONFIG, type AuthConfig } from "@pos-cloud/config";
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from "@pos-cloud/shared-kernel";
import { AdminSession } from "../../domain/admin-session";
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepository,
} from "../../domain/admin-session-repository.port";
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from "../../domain/admin-user-repository.port";
import type { AdminUserStatus } from "../../domain/admin-user-status";
import { InvalidAdminCredentialsError } from "../../domain/admin-user.errors";
import { Email } from "../../domain/email";
import { ACCESS_TOKEN_ISSUER, type AccessTokenIssuerPort } from "../ports/access-token.port";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port";
import {
  REFRESH_TOKEN_GENERATOR,
  type RefreshTokenGeneratorPort,
} from "../ports/refresh-token-generator.port";

export interface LoginAdminCommand {
  readonly email: string;
  readonly password: string;
}

export interface LoginAdminResult {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly refreshToken: { readonly sessionId: string; readonly secret: string };
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly status: AdminUserStatus;
  };
}

/**
 * Every rejection path (unknown email, wrong password, locked account, suspended account) throws
 * the same InvalidAdminCredentialsError (401 INVALID_CREDENTIALS) - see that error's own comment
 * and docs/architecture/admin-authentication.md#login-failure--lockout. The failed-attempt counter
 * is only incremented for a genuinely wrong password on an account that could still attempt login
 * (see AdminUser.recordFailedLogin's contract) - not for an unknown email or an already-locked/
 * suspended account, which must not extend or fabricate a lockout window.
 *
 * Timing side-channel: every rejection reachable before a real password check - unknown email,
 * locked, suspended - still pays the same Argon2id cost as a wrong password on an attemptable
 * account, via passwordHasher.verifyDummy() (see PasswordHasherPort). Without this, those paths
 * would return measurably faster than "wrong password" (no Argon2id run at all), letting an
 * attacker enumerate valid admin emails, or distinguish a locked/suspended account from an active
 * one with a wrong password, by response latency alone. Exactly one costly verification ever runs
 * per request - never both a dummy and a real one, never zero.
 */
@Injectable()
export class LoginAdminUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly users: AdminUserRepository,
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly accessTokenIssuer: AccessTokenIssuerPort,
    @Inject(REFRESH_TOKEN_GENERATOR)
    private readonly refreshTokenGenerator: RefreshTokenGeneratorPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  async execute(command: LoginAdminCommand): Promise<LoginAdminResult> {
    const email = Email.create(command.email);
    const user = await this.users.findByEmail(email);
    const now = this.clock.now();

    if (!user) {
      // No AdminUser for this email - still pay the Argon2id cost so this path is not
      // distinguishable by timing from "wrong password for an existing account" below.
      await this.passwordHasher.verifyDummy(command.password);
      throw new InvalidAdminCredentialsError();
    }

    if (!user.canAttemptLogin(now)) {
      // Locked (lockedUntil > now) or SUSPENDED (the only other AdminUserStatus) - same reasoning
      // as the unknown-email branch above: still pay the Argon2id cost so this path isn't
      // distinguishable by timing from "wrong password for an active account" below. Never verified
      // against the real hash - we already know this identity cannot authenticate right now, so
      // there is nothing to gain and it would make behavior depend on whether the (irrelevant)
      // presented password happens to be correct.
      await this.passwordHasher.verifyDummy(command.password);
      throw new InvalidAdminCredentialsError();
    }

    const passwordValid = await this.passwordHasher.verify(user.passwordHash, command.password);
    if (!passwordValid) {
      user.recordFailedLogin(this.clock);
      await this.users.save(user);
      throw new InvalidAdminCredentialsError();
    }

    user.recordSuccessfulLogin(this.clock);
    await this.users.save(user);

    const sessionId = this.idGenerator.next();
    const secret = this.refreshTokenGenerator.generateSecret();
    const refreshTokenHash = this.refreshTokenGenerator.hashSecret(secret);
    const expiresAt = new Date(now.getTime() + this.authConfig.refreshTokenTtlSeconds * 1000);

    const session = AdminSession.create(
      { id: sessionId, adminUserId: user.id.toString(), refreshTokenHash, expiresAt },
      this.clock,
    );
    await this.sessions.save(session);

    const issued = await this.accessTokenIssuer.issue({ sub: user.id.toString(), sid: sessionId });

    return {
      accessToken: issued.token,
      expiresInSeconds: issued.expiresInSeconds,
      refreshToken: { sessionId, secret },
      user: {
        id: user.id.toString(),
        email: user.email.toString(),
        displayName: user.displayName,
        status: user.status,
      },
    };
  }
}
