/**
 * Port for obtaining the current time. Domain and application code must depend on this
 * abstraction rather than `new Date()` / `Date.now()` directly, so time can be controlled in tests
 * and kept consistent across a use case execution.
 */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
