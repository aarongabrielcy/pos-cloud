import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { FakeDatabaseModule } from "../test-support/fake-database.module";
import { ControlPlaneModule } from "./control-plane.module";

/**
 * Regression test for the OpenAPI document main.ts generates from live decorators (see
 * docs/adr/ADR-011). Boots the real ControlPlaneModule - real controllers, real DTOs, real
 * decorators - with only the DataSource faked (no PostgreSQL, no migration). Checks the minimum
 * set of paths/operations a consumer (pos-admin-web, per ADR-011) would rely on; not a full
 * snapshot, so unrelated additions to the document don't make this brittle.
 */
describe("OpenAPI document regression", () => {
  it("includes every critical control-plane path and HTTP operation", async () => {
    // ControlPlaneModule now also imports AuthConfigModule (CLOUD-01C-A), which calls
    // loadAuthConfig() the moment it is imported - jest.setup-env.js guarantees AUTH_JWT_SECRET
    // already exists in process.env by then (see that file's own comment for why it has to run
    // before any spec file is required, not just before this test body).
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDatabaseModule, ControlPlaneModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("POSPlatform Cloud - Control Plane API")
        .setVersion("1.0")
        .addTag("customers")
        .addTag("licenses")
        .addTag("installations")
        .addTag("auth")
        .addTag("installation-auth")
        .addTag("installation-health")
        .addTag("audit")
        .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "admin-bearer")
        .addBearerAuth(
          { type: "http", scheme: "bearer", bearerFormat: "<credentialId>.<secret>" },
          "installation-bearer",
        )
        .build(),
    );

    const expectedOperations: Array<{ path: string; methods: string[] }> = [
      { path: "/api/v1/control-plane/customers", methods: ["post", "get"] },
      { path: "/api/v1/control-plane/customers/{id}", methods: ["get"] },
      { path: "/api/v1/control-plane/customers/{id}/status", methods: ["patch"] },
      { path: "/api/v1/control-plane/licenses", methods: ["post", "get"] },
      { path: "/api/v1/control-plane/licenses/{id}", methods: ["get"] },
      { path: "/api/v1/control-plane/licenses/{id}/status", methods: ["patch"] },
      { path: "/api/v1/control-plane/licenses/{id}/entitlements", methods: ["put"] },
      { path: "/api/v1/control-plane/installations", methods: ["post", "get"] },
      { path: "/api/v1/control-plane/installations/{id}", methods: ["get"] },
      { path: "/api/v1/control-plane/installations/{id}/status", methods: ["patch"] },
      { path: "/api/v1/control-plane/installations/{id}/enrollment", methods: ["post"] },
      {
        path: "/api/v1/control-plane/installations/{id}/credentials/recovery-enrollment",
        methods: ["post"],
      },
      { path: "/api/v1/control-plane/installations/{id}/credentials/revoke", methods: ["post"] },
      { path: "/api/v1/control-plane/installations/{id}/health", methods: ["get"] },
      { path: "/api/v1/control-plane/audit-events", methods: ["get"] },
      { path: "/api/v1/auth/login", methods: ["post"] },
      { path: "/api/v1/auth/refresh", methods: ["post"] },
      { path: "/api/v1/auth/logout", methods: ["post"] },
      { path: "/api/v1/auth/me", methods: ["get"] },
      { path: "/api/v1/installation-auth/enroll", methods: ["post"] },
      { path: "/api/v1/installation-auth/session", methods: ["get"] },
      { path: "/api/v1/installation-health/heartbeat", methods: ["post"] },
    ];

    for (const { path, methods } of expectedOperations) {
      expect(document.paths).toHaveProperty(path);
      const operations = document.paths[path];
      for (const method of methods) {
        expect(operations).toHaveProperty(method);
      }
    }

    await app.close();
  });

  it("documents Bearer admin auth on every business operation, but not on the public auth endpoints (CLOUD-01C-B)", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDatabaseModule, ControlPlaneModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("POSPlatform Cloud - Control Plane API")
        .setVersion("1.0")
        .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "admin-bearer")
        .addBearerAuth(
          { type: "http", scheme: "bearer", bearerFormat: "<credentialId>.<secret>" },
          "installation-bearer",
        )
        .build(),
    );

    const requiresBearerAuth: Array<{ path: string; method: string }> = [
      { path: "/api/v1/control-plane/customers", method: "post" },
      { path: "/api/v1/control-plane/customers", method: "get" },
      { path: "/api/v1/control-plane/customers/{id}", method: "get" },
      { path: "/api/v1/control-plane/customers/{id}/status", method: "patch" },
      { path: "/api/v1/control-plane/licenses", method: "post" },
      { path: "/api/v1/control-plane/licenses", method: "get" },
      { path: "/api/v1/control-plane/licenses/{id}", method: "get" },
      { path: "/api/v1/control-plane/licenses/{id}/status", method: "patch" },
      { path: "/api/v1/control-plane/licenses/{id}/entitlements", method: "put" },
      { path: "/api/v1/control-plane/installations", method: "post" },
      { path: "/api/v1/control-plane/installations", method: "get" },
      { path: "/api/v1/control-plane/installations/{id}", method: "get" },
      { path: "/api/v1/control-plane/installations/{id}/status", method: "patch" },
      { path: "/api/v1/control-plane/installations/{id}/enrollment", method: "post" },
      {
        path: "/api/v1/control-plane/installations/{id}/credentials/recovery-enrollment",
        method: "post",
      },
      { path: "/api/v1/control-plane/installations/{id}/credentials/revoke", method: "post" },
      { path: "/api/v1/control-plane/installations/{id}/health", method: "get" },
      { path: "/api/v1/control-plane/audit-events", method: "get" },
      { path: "/api/v1/auth/me", method: "get" },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function operation(path: string, method: string): any {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (document.paths[path] as any)[method];
    }

    for (const { path, method } of requiresBearerAuth) {
      const security = operation(path, method).security;
      expect(security).toEqual(
        expect.arrayContaining([expect.objectContaining({ "admin-bearer": [] })]),
      );
    }

    const publicNoAuth: Array<{ path: string; method: string }> = [
      { path: "/api/v1/auth/login", method: "post" },
      { path: "/api/v1/auth/refresh", method: "post" },
      { path: "/api/v1/auth/logout", method: "post" },
    ];

    for (const { path, method } of publicNoAuth) {
      const security = operation(path, method).security;
      const hasAdminBearer = (security ?? []).some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => "admin-bearer" in entry,
      );
      expect(hasAdminBearer).toBe(false);
    }

    await app.close();
  });

  it("documents installation-bearer on GET /installation-auth/session only - never mixed with admin-bearer, and absent from POST /installation-auth/enroll (CLOUD-01C-C)", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDatabaseModule, ControlPlaneModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("POSPlatform Cloud - Control Plane API")
        .setVersion("1.0")
        .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "admin-bearer")
        .addBearerAuth(
          { type: "http", scheme: "bearer", bearerFormat: "<credentialId>.<secret>" },
          "installation-bearer",
        )
        .build(),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function operation(path: string, method: string): any {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (document.paths[path] as any)[method];
    }

    const sessionSecurity = operation("/api/v1/installation-auth/session", "get").security;
    expect(sessionSecurity).toEqual(
      expect.arrayContaining([expect.objectContaining({ "installation-bearer": [] })]),
    );
    const sessionHasAdminBearer = (sessionSecurity ?? []).some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (entry: any) => "admin-bearer" in entry,
    );
    expect(sessionHasAdminBearer).toBe(false);

    const enrollSecurity = operation("/api/v1/installation-auth/enroll", "post").security;
    const enrollHasAnyBearer = (enrollSecurity ?? []).some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (entry: any) => "admin-bearer" in entry || "installation-bearer" in entry,
    );
    expect(enrollHasAnyBearer).toBe(false);

    await app.close();
  });

  it("documents installation-bearer on POST /installation-health/heartbeat only, and admin-bearer on GET /control-plane/audit-events only (CLOUD-01C-D)", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDatabaseModule, ControlPlaneModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("POSPlatform Cloud - Control Plane API")
        .setVersion("1.0")
        .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "admin-bearer")
        .addBearerAuth(
          { type: "http", scheme: "bearer", bearerFormat: "<credentialId>.<secret>" },
          "installation-bearer",
        )
        .build(),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function operation(path: string, method: string): any {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (document.paths[path] as any)[method];
    }

    const heartbeatSecurity = operation("/api/v1/installation-health/heartbeat", "post").security;
    expect(heartbeatSecurity).toEqual(
      expect.arrayContaining([expect.objectContaining({ "installation-bearer": [] })]),
    );
    const heartbeatHasAdminBearer = (heartbeatSecurity ?? []).some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (entry: any) => "admin-bearer" in entry,
    );
    expect(heartbeatHasAdminBearer).toBe(false);

    const auditSecurity = operation("/api/v1/control-plane/audit-events", "get").security;
    expect(auditSecurity).toEqual(
      expect.arrayContaining([expect.objectContaining({ "admin-bearer": [] })]),
    );
    const auditHasInstallationBearer = (auditSecurity ?? []).some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (entry: any) => "installation-bearer" in entry,
    );
    expect(auditHasInstallationBearer).toBe(false);

    await app.close();
  });
});
