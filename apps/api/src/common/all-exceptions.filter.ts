import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ConflictError, NotFoundError, ValidationError } from "@pos-cloud/shared-kernel";
import type { Request, Response } from "express";
import { PinoLogger } from "nestjs-pino";

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  correlationId: string;
  details?: unknown;
}

/**
 * Single, consistent business API error contract: { statusCode, code, message, correlationId,
 * details? }. Maps the shared-kernel error taxonomy (NotFoundError -> 404, ConflictError -> 409,
 * ValidationError -> 400) generically - it never imports a bounded-context-specific error class,
 * since every context's errors already extend one of these three shared base classes. Never
 * leaks a stack trace, SQL, or internal path to the client; unexpected errors are logged
 * server-side (with correlationId) and returned as a generic 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string | number }>();
    const correlationId = request.id !== undefined ? String(request.id) : "unknown";

    const body = this.buildBody(exception, correlationId);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error({ err: exception, correlationId }, "Unhandled exception");
    }

    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown, correlationId: string): ErrorBody {
    if (exception instanceof NotFoundError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        code: exception.code,
        message: exception.message,
        correlationId,
      };
    }

    if (exception instanceof ConflictError) {
      return {
        statusCode: HttpStatus.CONFLICT,
        code: exception.code,
        message: exception.message,
        correlationId,
      };
    }

    if (exception instanceof ValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
        correlationId,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const { message, details } = normalizeHttpExceptionResponse(
        exception.getResponse(),
        exception.message,
      );
      return {
        statusCode: status,
        code: httpStatusToCode(status),
        message,
        correlationId,
        details,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      correlationId,
    };
  }
}

function normalizeHttpExceptionResponse(
  responseBody: unknown,
  fallbackMessage: string,
): { message: string; details?: unknown } {
  if (typeof responseBody === "string") {
    return { message: responseBody };
  }

  if (responseBody && typeof responseBody === "object") {
    const body = responseBody as { message?: unknown };
    if (Array.isArray(body.message)) {
      return { message: "Validation failed", details: body.message };
    }
    if (typeof body.message === "string") {
      return { message: body.message };
    }
  }

  return { message: fallbackMessage };
}

function httpStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "VALIDATION_ERROR";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    default:
      return "HTTP_ERROR";
  }
}
