import type { LoggerService } from "@nestjs/common";
import type { Logger as PinoLogger } from "pino";

/** Adapts a plain pino logger to Nest's LoggerService interface for use as the app-wide logger. */
export class PinoLoggerAdapter implements LoggerService {
  constructor(private readonly logger: PinoLogger) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.info({ context: optionalParams[optionalParams.length - 1] }, String(message));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.error({ context: optionalParams[optionalParams.length - 1] }, String(message));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn({ context: optionalParams[optionalParams.length - 1] }, String(message));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug({ context: optionalParams[optionalParams.length - 1] }, String(message));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.trace({ context: optionalParams[optionalParams.length - 1] }, String(message));
  }
}
