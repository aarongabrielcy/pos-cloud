import { Column, Entity, PrimaryColumn } from "typeorm";
import type { InstallationEnrollmentPurpose } from "../../domain/installation-enrollment-purpose";

/**
 * TypeORM persistence record for `installations.installation_enrollments`. Same-context FK only
 * (installation_id -> installations.installations.id) - see ADR-010.
 */
@Entity({ name: "installation_enrollments", schema: "installations" })
export class InstallationEnrollmentRecord {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ name: "installation_id", type: "uuid" })
  installationId!: string;

  @Column({ type: "varchar", length: 20 })
  purpose!: InstallationEnrollmentPurpose;

  // Never the raw enrollment code - see InstallationSecretGeneratorPort/InstallationEnrollment's own comments.
  @Column({ name: "code_hash", type: "varchar", length: 64 })
  codeHash!: string;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({ name: "consumed_at", type: "timestamptz", nullable: true, default: null })
  consumedAt!: Date | null;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true, default: null })
  revokedAt!: Date | null;
}
