import { randomUUID } from "node:crypto";

/**
 * Port for generating aggregate IDs. Domain/application code depends on this abstraction rather
 * than calling `crypto.randomUUID()` directly, so ID generation can be substituted in tests and
 * aggregate identity is never delegated to PostgreSQL (e.g. no serial/identity columns).
 */
export interface IdGenerator {
  next(): string;
}

/** DI token for injecting an IdGenerator in frameworks (e.g. NestJS) that resolve by token. */
export const ID_GENERATOR = Symbol("ID_GENERATOR");

/** Standard UUID v4 generator backed by Node's built-in crypto module - no external dependency. */
export class RandomUuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
