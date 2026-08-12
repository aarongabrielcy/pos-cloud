import { Column, Entity, PrimaryColumn } from "typeorm";
import { CustomerStatus } from "../../domain/customer-status";

/**
 * TypeORM persistence record for the `control_plane.customers` table. Deliberately NOT the
 * Domain Entity - see CustomerMapper for the translation between this shape and `Customer`.
 */
@Entity({ name: "customers", schema: "control_plane" })
export class CustomerRecord {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ type: "varchar", length: 50, unique: true })
  code!: string;

  @Column({ name: "legal_name", type: "varchar", length: 200 })
  legalName!: string;

  @Column({ name: "trade_name", type: "varchar", length: 200, nullable: true, default: null })
  tradeName!: string | null;

  @Column({ type: "varchar", length: 20 })
  status!: CustomerStatus;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
