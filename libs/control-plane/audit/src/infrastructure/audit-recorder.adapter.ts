import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  type AuditEventInput,
  type AuditRecorderPort,
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
} from "@pos-cloud/shared-kernel";
import type { AuditEvent } from "../domain/audit-event";
import {
  AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from "../application/ports/audit-event-repository.port";

/**
 * Implements shared-kernel's AuditRecorderPort - the one concrete binding every producer bounded
 * context (customer-management, licensing, installations, access-management) calls into via DI,
 * without any of them importing this package directly (see ADR-015). Best-effort, V1 (no Outbox):
 * `record()` NEVER rejects - a persistence failure is caught here, logged safely (action/
 * resourceType/resourceId/correlationId/actorType/actorId only, never metadata, which may contain
 * user-supplied values), and swallowed, so a transient audit-write failure can never fail the
 * business action that triggered it.
 */
@Injectable()
export class AuditRecorderAdapter implements AuditRecorderPort {
  private readonly logger = new Logger(AuditRecorderAdapter.name);

  constructor(
    @Inject(AUDIT_EVENT_REPOSITORY) private readonly repository: AuditEventRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async record(input: AuditEventInput): Promise<void> {
    const event: AuditEvent = {
      id: this.idGenerator.next(),
      occurredAt: this.clock.now(),
      actorType: input.actor.actorType,
      actorId: input.actor.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      correlationId: input.actor.correlationId,
      metadata: input.metadata,
    };

    try {
      await this.repository.insert(event);
    } catch (error) {
      this.logger.error(
        `Failed to persist audit event (action=${event.action}, resourceType=${event.resourceType}, ` +
          `resourceId=${event.resourceId}, correlationId=${event.correlationId}, ` +
          `actorType=${event.actorType}, actorId=${event.actorId ?? "null"}): ` +
          `${(error as Error).message}`,
      );
    }
  }
}
