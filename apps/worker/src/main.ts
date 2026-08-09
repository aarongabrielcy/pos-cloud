import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadConfig } from "@pos-cloud/config";
import { createLogger } from "@pos-cloud/observability";
import { PinoLoggerAdapter } from "./observability/pino-logger.adapter";
import { WorkerModule } from "./worker.module";

async function bootstrap(): Promise<void> {
  // Fail fast, before Nest even starts building the module graph.
  const config = loadConfig();

  const pino = createLogger({
    service: config.app.name,
    environment: config.env,
    level: config.logging.level,
  });

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: new PinoLoggerAdapter(pino),
  });

  app.enableShutdownHooks();

  pino.info(
    "Worker process started; no business jobs are scheduled yet (CLOUD-01A foundation only)",
  );
}

bootstrap();
