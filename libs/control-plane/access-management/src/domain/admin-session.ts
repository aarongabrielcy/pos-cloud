import type { Clock } from "@pos-cloud/shared-kernel";
import { AdminSessionId } from "./admin-session-id";

export interface AdminSessionProps {
  id: AdminSessionId;
  adminUserId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: AdminSessionId | null;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface CreateAdminSessionInput {
  id: string;
  adminUserId: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

/**
 * A single administrative refresh session. The opaque refresh token itself is never stored -
 * only `refreshTokenHash` (a SHA-256 digest, see RefreshTokenHasherPort) - so a database read
 * alone never yields a usable token. `replacedBySessionId` forms the rotation chain used to detect
 * refresh-token replay (see docs/architecture/admin-authentication.md#refresh-token-rotation).
 */
export class AdminSession {
  private constructor(private props: AdminSessionProps) {}

  static create(input: CreateAdminSessionInput, clock: Clock): AdminSession {
    const now = clock.now();

    return new AdminSession({
      id: AdminSessionId.of(input.id),
      adminUserId: input.adminUserId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      replacedBySessionId: null,
      createdAt: now,
      lastUsedAt: now,
    });
  }

  /** Rehydrates an AdminSession from already-validated persisted state - no re-validation. */
  static reconstitute(props: AdminSessionProps): AdminSession {
    return new AdminSession(props);
  }

  isExpired(now: Date): boolean {
    return this.props.expiresAt <= now;
  }

  isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  /** Not revoked and not expired - the only state from which this session may be rotated or used. */
  isActive(now: Date): boolean {
    return !this.isRevoked() && !this.isExpired(now);
  }

  /**
   * Revokes this session, optionally recording which session replaced it (set during rotation).
   * Idempotent in effect: revoking an already-revoked session just overwrites revokedAt/replacedBy,
   * which callers never do in practice (rotation and replay-mitigation each revoke a session at
   * most once).
   */
  revoke(clock: Clock, replacedBySessionId?: AdminSessionId): void {
    this.props.revokedAt = clock.now();
    if (replacedBySessionId) {
      this.props.replacedBySessionId = replacedBySessionId;
    }
  }

  touch(clock: Clock): void {
    this.props.lastUsedAt = clock.now();
  }

  get id(): AdminSessionId {
    return this.props.id;
  }

  get adminUserId(): string {
    return this.props.adminUserId;
  }

  get refreshTokenHash(): string {
    return this.props.refreshTokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  get replacedBySessionId(): AdminSessionId | null {
    return this.props.replacedBySessionId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get lastUsedAt(): Date {
    return this.props.lastUsedAt;
  }
}
