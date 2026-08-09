/**
 * Marker contract for events raised by domain/application code inside a bounded context.
 * Kept intentionally minimal for CLOUD-01A: no business events exist yet.
 *
 * NOTE: critical persistent integrations MUST use a transactional outbox/inbox when they are
 * introduced (see docs/adr/ADR-006 discussion and libs/messaging README notes). Fire-and-forget
 * publication of events tied to critical flows (payments, licensing, sync) is not acceptable.
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredAt: Date;
}

/**
 * Marker contract for events raised by application-layer orchestration (as opposed to a domain
 * invariant). Distinguished from DomainEvent so future handlers can reason about origin.
 */
export interface ApplicationEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredAt: Date;
}
