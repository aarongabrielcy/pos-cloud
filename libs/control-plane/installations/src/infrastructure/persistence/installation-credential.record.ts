import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * TypeORM persistence record for `installations.installation_credentials`. Same-context FK only
 * (installation_id -> installations.installations.id) - see ADR-010.
 */
@Entity({ name: "installation_credentials", schema: "installations" })
export class InstallationCredentialRecord {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ name: "installation_id", type: "uuid" })
  installationId!: string;

  // Never the raw credential secret - see InstallationSecretGeneratorPort/InstallationCredential's own comments.
  @Column({ name: "secret_hash", type: "varchar", length: 64 })
  secretHash!: string;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true, default: null })
  revokedAt!: Date | null;
}
