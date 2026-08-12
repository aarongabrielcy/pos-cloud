import { Module } from "@nestjs/common";
import type { AppConfig } from "@pos-cloud/config";
import {
  CORRELATION_ID_HEADER,
  createLoggerOptions,
  resolveCorrelationId,
} from "@pos-cloud/observability";
import type { IncomingMessage, ServerResponse } from "http";
import { LoggerModule } from "nestjs-pino";
import { APP_CONFIG } from "../config/app-config.tokens";

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          ...createLoggerOptions({
            service: config.app.name,
            environment: config.env,
            level: config.logging.level,
          }),
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            // main.ts's correlationIdMiddleware runs before Nest's body parser and already sets
            // req.id for every request (including ones with a malformed body, which never reach
            // this point at all) - reuse it here instead of resolving a second, different id.
            if (req.id) {
              const existing = String(req.id);
              res.setHeader(CORRELATION_ID_HEADER, existing);
              return existing;
            }
            const incoming = req.headers[CORRELATION_ID_HEADER];
            const correlationId = resolveCorrelationId(
              Array.isArray(incoming) ? incoming[0] : incoming,
            );
            res.setHeader(CORRELATION_ID_HEADER, correlationId);
            return correlationId;
          },
          customProps: (req) => ({
            correlationId: String(req.id ?? ""),
          }),
        },
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
