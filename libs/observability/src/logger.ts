import pino, { type Logger, type LoggerOptions } from "pino";
import { REDACTED_PATHS, REDACTION_CENSOR } from "./redaction";

export interface LoggerContext {
  service: string;
  environment: string;
  level: string;
}

/** Builds structured JSON logging options shared by every process (API, worker, CLI tooling). */
export function createLoggerOptions(context: LoggerContext): LoggerOptions {
  return {
    level: context.level,
    base: {
      service: context.service,
      environment: context.environment,
    },
    redact: {
      paths: REDACTED_PATHS,
      censor: REDACTION_CENSOR,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
}

export function createLogger(context: LoggerContext): Logger {
  return pino(createLoggerOptions(context));
}
