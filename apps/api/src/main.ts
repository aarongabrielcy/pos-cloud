import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { loadConfig } from "@pos-cloud/config";
import { correlationIdMiddleware } from "@pos-cloud/observability";
import cookieParser from "cookie-parser";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  // Fail fast, before Nest even starts building the module graph.
  const config = loadConfig();

  // bodyParser: false + a manual json()/urlencoded() install below is required so
  // correlationIdMiddleware can run first, before body parsing can throw on malformed JSON. Nest's
  // default (bodyParser left enabled) always installs its own parser immediately at create() time -
  // before any app.use() call in this function, and before nestjs-pino's own request-id middleware,
  // which only attaches later during Nest's module-driven middleware phase. Without this reordering,
  // a malformed body throws before any correlation id is ever assigned, and AllExceptionsFilter
  // falls back to "unknown".
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(correlationIdMiddleware);
  app.use(json());
  app.use(urlencoded({ extended: true }));
  // Populates req.cookies for AuthController (login/refresh/logout) - the refresh token travels
  // only as an HttpOnly cookie, never in a request/response body (see docs/architecture/
  // admin-authentication.md#cookie-policy). Not signed: the cookie's value is itself an opaque,
  // unguessable, hashed-at-rest token - an HMAC signature would add no real protection against
  // tampering that the hash-comparison in RefreshAdminSessionUseCase doesn't already catch.
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  // Swagger/OpenAPI is generated from live decorators (never a static openapi.json), and is
  // development-only by default - production deployments must explicitly opt back in via NODE_ENV
  // (see docs/adr/ADR-011). Since CLOUD-01C-B, every Customers/Licenses/Installations route requires
  // a Bearer access token AND the specific permission listed in docs/architecture/admin-rbac.md's
  // protection matrix (AccessTokenGuard + AdminAuthorizationGuard, registered globally in
  // ControlPlaneModule) - only login/refresh/logout (@Public()) and /health (@Public()) are reachable
  // without one.
  if (config.env !== "production") {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("POSPlatform Cloud - Control Plane API")
        .setDescription(
          "Vendor/Admin Control Plane: Customer Management, Licensing, Installations, Auth. " +
            "Customers/Licenses/Installations require a Bearer admin access token and RBAC permission.",
        )
        .setVersion("1.0")
        .addTag("customers")
        .addTag("licenses")
        .addTag("installations")
        .addTag("auth")
        .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "admin-bearer")
        .build(),
    );
    SwaggerModule.setup("docs", app, document);
    // getHttpAdapter().get() types `res` via Nest's abstract HttpServer interface, which doesn't
    // include `.json()`. getInstance() returns the real, fully-typed underlying Express app.
    app
      .getHttpAdapter()
      .getInstance()
      .get("/openapi.json", (_req, res) => res.json(document));
  }

  await app.listen(config.app.port);
}

bootstrap();
