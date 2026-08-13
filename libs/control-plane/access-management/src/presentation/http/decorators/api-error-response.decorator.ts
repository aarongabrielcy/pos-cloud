import { applyDecorators } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";

/**
 * One class-level decorator per controller (never per-handler) describing AllExceptionsFilter's one,
 * true HTTP error contract - `{ statusCode, code, message, correlationId, details? }` - see
 * apps/api/src/common/all-exceptions.filter.ts. Registered under OpenAPI's `default` response key
 * (the schema for any status this operation doesn't otherwise document), so every 4xx/5xx a handler
 * can throw shares this one schema instead of 40 near-duplicate per-handler `@ApiResponse` decorators
 * (see BACKEND-HARDENING-01's own report for why: this repo doesn't want to hand-enumerate every
 * domain error a use case might throw, and AllExceptionsFilter's contract never varies by handler
 * anyway - only `statusCode`/`code`/`message` values do, which a generic schema doesn't need to know).
 */
export const ApiErrorResponse = (): ClassDecorator =>
  applyDecorators(
    ApiResponse({
      status: "default",
      description: "Error response (AllExceptionsFilter's single error contract)",
      schema: {
        type: "object",
        properties: {
          statusCode: { type: "number", example: 400 },
          code: { type: "string", example: "VALIDATION_ERROR" },
          message: { type: "string" },
          correlationId: { type: "string" },
          details: {},
        },
        required: ["statusCode", "code", "message", "correlationId"],
      },
    }),
  ) as ClassDecorator;
