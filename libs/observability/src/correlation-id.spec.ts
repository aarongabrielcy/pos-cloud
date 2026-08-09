import {
  generateCorrelationId,
  isValidCorrelationId,
  resolveCorrelationId,
} from "./correlation-id";

describe("correlation ID", () => {
  it("generates a correlation ID when none is supplied", () => {
    const id = resolveCorrelationId(undefined);

    expect(isValidCorrelationId(id)).toBe(true);
  });

  it("propagates a supplied, well-formed correlation ID", () => {
    const supplied = "req-abc-123.trace";

    expect(resolveCorrelationId(supplied)).toBe(supplied);
  });

  it("rejects and replaces an unsafe correlation ID", () => {
    const malicious = "not\nsafe\r\nX-Injected: true";

    const resolved = resolveCorrelationId(malicious);

    expect(resolved).not.toBe(malicious);
    expect(isValidCorrelationId(resolved)).toBe(true);
  });

  it("generates unique IDs across calls", () => {
    expect(generateCorrelationId()).not.toBe(generateCorrelationId());
  });
});
