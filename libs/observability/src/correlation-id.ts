import { randomUUID } from "node:crypto";

/** HTTP header used to propagate a correlation ID across a request. */
export const CORRELATION_ID_HEADER = "x-correlation-id";

/**
 * Conservative allow-list for an inbound correlation ID: alphanumeric plus dash/underscore/dot,
 * bounded length. Anything outside this shape is treated as untrusted and replaced, since the
 * value flows straight into structured logs and the response header.
 */
const SAFE_CORRELATION_ID = /^[a-zA-Z0-9._-]{1,128}$/;

export function generateCorrelationId(): string {
  return randomUUID();
}

export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === "string" && SAFE_CORRELATION_ID.test(value);
}

/** Returns the incoming correlation ID if it is safe to reuse, otherwise generates a new one. */
export function resolveCorrelationId(incoming: unknown): string {
  return isValidCorrelationId(incoming) ? incoming : generateCorrelationId();
}
