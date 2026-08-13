import { Column, Entity, PrimaryColumn } from "typeorm";

/** TypeORM persistence record for `audit.audit_events` - append-only, no update/delete anywhere in this package. */
@Entity({ name: "audit_events", schema: "audit" })
export class AuditEventRecord {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ name: "occurred_at", type: "timestamptz" })
  occurredAt!: Date;

  @Column({ name: "actor_type", type: "varchar", length: 20 })
  actorType!: string;

  @Column({ name: "actor_id", type: "varchar", length: 100, nullable: true })
  actorId!: string | null;

  @Column({ type: "varchar", length: 100 })
  action!: string;

  @Column({ name: "resource_type", type: "varchar", length: 50 })
  resourceType!: string;

  @Column({ name: "resource_id", type: "varchar", length: 100 })
  resourceId!: string;

  @Column({ name: "correlation_id", type: "varchar", length: 128 })
  correlationId!: string;

  @Column({ type: "jsonb" })
  metadata!: Record<string, unknown>;
}
