import { Column, Entity, PrimaryColumn } from "typeorm";
import type { InstallationStatus } from "../../domain/installation-status";
import type { Platform } from "../../domain/platform";

/**
 * TypeORM persistence record for `installations.installations`. No foreign keys to
 * `control_plane.customers` or `licensing.licenses` - those relationships are cross-bounded-context
 * and resolved via application ports, never PostgreSQL FKs (see ADR-010).
 */
@Entity({ name: "installations", schema: "installations" })
export class InstallationRecord {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ name: "customer_id", type: "uuid" })
  customerId!: string;

  @Column({ name: "license_id", type: "uuid" })
  licenseId!: string;

  @Column({ name: "installation_code", type: "varchar", length: 80, unique: true })
  installationCode!: string;

  @Column({ type: "varchar", length: 150 })
  name!: string;

  @Column({ type: "varchar", length: 20 })
  platform!: Platform;

  @Column({ type: "varchar", length: 20 })
  status!: InstallationStatus;

  @Column({ name: "registered_at", type: "timestamptz", nullable: true, default: null })
  registeredAt!: Date | null;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
