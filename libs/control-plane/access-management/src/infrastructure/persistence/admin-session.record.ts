import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * TypeORM persistence record for `access_management.admin_sessions`. Same-context FKs only
 * (admin_user_id -> admin_users.id, replaced_by_session_id -> admin_sessions.id) - no FK crosses a
 * schema boundary (see ADR-010), and neither of these does.
 */
@Entity({ name: "admin_sessions", schema: "access_management" })
export class AdminSessionRecord {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ name: "admin_user_id", type: "uuid" })
  adminUserId!: string;

  // Never the raw refresh token - see RefreshTokenGeneratorPort/AdminSession's own comments.
  @Column({ name: "refresh_token_hash", type: "varchar", length: 64 })
  refreshTokenHash!: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true, default: null })
  revokedAt!: Date | null;

  @Column({ name: "replaced_by_session_id", type: "uuid", nullable: true, default: null })
  replacedBySessionId!: string | null;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "last_used_at", type: "timestamptz" })
  lastUsedAt!: Date;
}
