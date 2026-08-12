import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from "typeorm";
import type { LicenseEdition } from "../../domain/license-edition";
import type { LicenseModel } from "../../domain/license-model";
import type { LicenseStatus } from "../../domain/license-status";

@Entity({ name: "licenses", schema: "licensing" })
export class LicenseRecord {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ name: "customer_id", type: "uuid" })
  customerId!: string;

  @Column({ name: "license_number", type: "varchar", length: 80, unique: true })
  licenseNumber!: string;

  @Column({ type: "varchar", length: 20 })
  edition!: LicenseEdition;

  @Column({ name: "license_model", type: "varchar", length: 20 })
  licenseModel!: LicenseModel;

  @Column({ type: "varchar", length: 20 })
  status!: LicenseStatus;

  @Column({ name: "valid_from", type: "timestamptz" })
  validFrom!: Date;

  @Column({ name: "valid_until", type: "timestamptz", nullable: true, default: null })
  validUntil!: Date | null;

  @Column({ name: "max_installations", type: "integer" })
  maxInstallations!: number;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => LicenseEntitlementRecord, (entitlement) => entitlement.license)
  entitlements?: LicenseEntitlementRecord[];
}

@Entity({ name: "license_entitlements", schema: "licensing" })
export class LicenseEntitlementRecord {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ name: "license_id", type: "uuid" })
  licenseId!: string;

  @Column({ type: "varchar", length: 100 })
  code!: string;

  @Column({ type: "boolean" })
  enabled!: boolean;

  @Column({ type: "jsonb", nullable: true, default: null })
  configuration!: Record<string, unknown> | null;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => LicenseRecord, (license) => license.entitlements, { onDelete: "CASCADE" })
  @JoinColumn({ name: "license_id" })
  license?: LicenseRecord;
}
