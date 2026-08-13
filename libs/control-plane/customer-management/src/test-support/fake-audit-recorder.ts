import type { AuditRecorderPort } from "@pos-cloud/shared-kernel";

/** Test double for AuditRecorderPort - never used in production code. Never throws, per the port's own contract. */
export class FakeAuditRecorder implements AuditRecorderPort {
  readonly recorded: Parameters<AuditRecorderPort["record"]>[0][] = [];

  async record(input: Parameters<AuditRecorderPort["record"]>[0]): Promise<void> {
    this.recorded.push(input);
  }
}
