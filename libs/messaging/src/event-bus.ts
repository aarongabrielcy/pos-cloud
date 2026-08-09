import type { ApplicationEvent, DomainEvent } from "./domain-event";

export type PublishableEvent = DomainEvent | ApplicationEvent;

export interface EventHandler<TEvent extends PublishableEvent = PublishableEvent> {
  handle(event: TEvent): Promise<void>;
}

/**
 * Port for publishing/subscribing to events within the modular monolith. No concrete transport
 * (Kafka/RabbitMQ/NATS) exists in Foundation - an in-process implementation is expected until a
 * bounded context is extracted. Implementations for critical flows must be backed by a
 * transactional outbox/inbox once such a flow exists.
 */
export interface EventBus {
  publish(event: PublishableEvent): Promise<void>;
  subscribe<TEvent extends PublishableEvent>(
    eventName: string,
    handler: EventHandler<TEvent>,
  ): void;
}
