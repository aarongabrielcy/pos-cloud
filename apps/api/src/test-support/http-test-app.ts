import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import { correlationIdMiddleware } from "@pos-cloud/observability";
import { json, urlencoded } from "express";
import type { PinoLogger } from "nestjs-pino";
import { AllExceptionsFilter } from "../common/all-exceptions.filter";
import { FakeDatabaseModule } from "./fake-database.module";

/**
 * Builds a TestingModule scaffold shared by every HTTP contract test: the real bounded-context
 * module(s) passed in, plus `FakeDatabaseModule` so their real `TypeOrmModule.forFeature(...)`
 * calls resolve without a PostgreSQL connection. Callers still override each use-case provider
 * with a fake - this only handles the module-boot-level DataSource dependency.
 */
export function createHttpTestModuleBuilder(imports: unknown[]): TestingModuleBuilder {
  return Test.createTestingModule({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    imports: [FakeDatabaseModule, ...(imports as any[])],
  });
}

/**
 * Boots a real Nest HTTP application from a compiled TestingModule, wired the same way `main.ts`
 * wires the real one: `bodyParser: false` + `correlationIdMiddleware` before a manual
 * `json()`/`urlencoded()` install (so a malformed body still gets a real correlation id - see that
 * middleware's own comment), the same global ValidationPipe config, and the real
 * AllExceptionsFilter.
 */
export async function initHttpTestApp(
  moduleBuilder: TestingModuleBuilder,
): Promise<INestApplication> {
  const moduleRef = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });

  app.use(correlationIdMiddleware);
  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const fakeLogger = {
    setContext: () => undefined,
    error: () => undefined,
    warn: () => undefined,
    info: () => undefined,
  } as unknown as PinoLogger;
  app.useGlobalFilters(new AllExceptionsFilter(fakeLogger));

  await app.init();
  return app;
}
