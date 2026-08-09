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
