import type { IncomingMessage, ServerResponse } from "node:http";
import { CORRELATION_ID_HEADER, resolveCorrelationId } from "./correlation-id";

export type RequestWithCorrelationId = IncomingMessage & { id?: string };

/**
 * Assigns `req.id` and the `x-correlation-id` response header from the inbound header (or a fresh
 * UUID). Framework-agnostic (Node's own `http` types, not Express's) so it can run as the very
 * first Express middleware - registered with `bodyParser: false` and a manual `json()`/
 * `urlencoded()` install afterward - guaranteeing a correlation ID exists even when the request
 * body is malformed and the body parser throws before Nest ever starts routing. Without this,
 * `AllExceptionsFilter` falls back to `correlationId: "unknown"`, since nestjs-pino's own
 * `genReqId` (registered via `LoggerModule`) only runs later, during Nest's own middleware phase -
 * after Nest's default body parser, which always runs first unless disabled.
 *
 * Idempotent: `genReqId` (see apps/api/src/observability/logging.module.ts) checks for an
 * already-set `req.id` and reuses it, so a request that DOES parse successfully still gets exactly
 * one correlation ID, not two independently-generated ones.
 */
export function correlationIdMiddleware(
  req: RequestWithCorrelationId,
  res: ServerResponse,
  next: () => void,
): void {
  const incoming = req.headers[CORRELATION_ID_HEADER];
  const correlationId = resolveCorrelationId(Array.isArray(incoming) ? incoming[0] : incoming);
  req.id = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
}
