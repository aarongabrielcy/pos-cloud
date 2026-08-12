import type { Clock } from "@pos-cloud/shared-kernel";

/** Test double for Clock - never used in production code. */
export class FixedClock implements Clock {
  constructor(private fixed: Date) {}

  now(): Date {
    return this.fixed;
  }

  advance(ms: number): void {
    this.fixed = new Date(this.fixed.getTime() + ms);
  }
}
