import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { PaginatedResult } from "@pos-cloud/shared-kernel";
import { buildPaginatedResult } from "@pos-cloud/shared-kernel";
import type { Repository } from "typeorm";
import type { AuditEvent } from "../../domain/audit-event";
import type {
  AuditEventRepository,
  ListAuditEventsCriteria,
} from "../../application/ports/audit-event-repository.port";
import { AuditEventMapper } from "./audit-event.mapper";
import { AuditEventRecord } from "./audit-event.record";

@Injectable()
export class TypeOrmAuditEventRepository implements AuditEventRepository {
  constructor(
    @InjectRepository(AuditEventRecord)
    private readonly repository: Repository<AuditEventRecord>,
  ) {}

  async insert(event: AuditEvent): Promise<void> {
    await this.repository.save(AuditEventMapper.toRecord(event));
  }

  async list(criteria: ListAuditEventsCriteria): Promise<PaginatedResult<AuditEvent>> {
    const qb = this.repository.createQueryBuilder("event");

    if (criteria.actorType) {
      qb.andWhere("event.actor_type = :actorType", { actorType: criteria.actorType });
    }
    if (criteria.actorId) {
      qb.andWhere("event.actor_id = :actorId", { actorId: criteria.actorId });
    }
    if (criteria.action) {
      qb.andWhere("event.action = :action", { action: criteria.action });
    }
    if (criteria.resourceType) {
      qb.andWhere("event.resource_type = :resourceType", { resourceType: criteria.resourceType });
    }
    if (criteria.resourceId) {
      qb.andWhere("event.resource_id = :resourceId", { resourceId: criteria.resourceId });
    }
    if (criteria.correlationId) {
      qb.andWhere("event.correlation_id = :correlationId", {
        correlationId: criteria.correlationId,
      });
    }
    if (criteria.from) {
      qb.andWhere("event.occurred_at >= :from", { from: criteria.from });
    }
    if (criteria.to) {
      qb.andWhere("event.occurred_at <= :to", { to: criteria.to });
    }

    // Stable pagination even when occurred_at ties (e.g. two events in the same millisecond).
    qb.orderBy("event.occurred_at", "DESC")
      .addOrderBy("event.id", "DESC")
      .skip((criteria.page - 1) * criteria.pageSize)
      .take(criteria.pageSize);

    const [records, total] = await qb.getManyAndCount();

    return buildPaginatedResult(records.map(AuditEventMapper.toDomain), total, criteria);
  }
}
