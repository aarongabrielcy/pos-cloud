import { Test } from "@nestjs/testing";
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { FakeDatabaseModule } from "../test-support/fake-database.module";
import { ControlPlaneModule } from "./control-plane.module";

// `@nestjs/swagger` only re-exports `OpenAPIObject` itself (not the nested Operation/Response/Schema
// interfaces it's built from) - derived via indexed access instead of importing an unexported
// internal path, so these stay correct if the package's shape ever changes.
type PathItem = NonNullable<OpenAPIObject["paths"][string]>;
type Operation = NonNullable<PathItem["get"]>;
type ResponseEntry = NonNullable<Operation["responses"][string]>;
type Response = Exclude<ResponseEntry, { $ref: string }>;
type SchemaOrRef = NonNullable<NonNullable<Response["content"]>[string]["schema"]>;
type Schema = Exclude<SchemaOrRef, { $ref: string }>;

/** Same DocumentBuilder config main.ts uses (see that file's own comment) - shared by every test below. */
async function buildDocument(): Promise<{ document: OpenAPIObject; close: () => Promise<void> }> {
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

  return { document, close: () => app.close() };
}

/** Resolves a single-level `$ref` against `components.schemas` - every response DTO here is a flat class reference, never nested. */
function resolveSchema(
  document: OpenAPIObject,
  schema: SchemaOrRef | undefined,
): Schema | undefined {
  if (schema && "$ref" in schema) {
    const schemaName = schema.$ref.replace("#/components/schemas/", "");
    return document.components?.schemas?.[schemaName] as Schema | undefined;
  }
  return schema;
}

function getOperation(document: OpenAPIObject, path: string, method: string): Operation {
  const pathItem = document.paths[path] as Record<string, Operation> | undefined;
  const operation = pathItem?.[method];
  if (!operation) {
    throw new Error(`${method.toUpperCase()} ${path} is missing from the document`);
  }
  return operation;
}

/** Every 25 current operations this task's response-contract work covers - see report section C/N. */
const ALL_OPERATIONS: ReadonlyArray<{ path: string; method: string }> = [
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
  { path: "/api/v1/auth/login", method: "post" },
  { path: "/api/v1/auth/refresh", method: "post" },
  { path: "/api/v1/auth/logout", method: "post" },
  { path: "/api/v1/auth/me", method: "get" },
  { path: "/api/v1/installation-auth/enroll", method: "post" },
  { path: "/api/v1/installation-auth/session", method: "get" },
  { path: "/api/v1/installation-health/heartbeat", method: "post" },
];

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

/**
 * BACKEND-HARDENING-01: regression coverage for the exact gap that blocked pos-cloud-web's WEB-01A -
 * `openapi-typescript` generating `content?: never` for every 2xx response because no handler
 * declared `@ApiOkResponse`/`@ApiCreatedResponse`/`@ApiNoContentResponse`. Every current success
 * response across all 25 operations must now have a real, resolvable body schema (except 204s, which
 * must have none) - this is what keeps that regression from silently coming back on a future handler.
 */
describe("Response contract completeness (BACKEND-HARDENING-01)", () => {
  it("every current operation's 2xx responses either have a resolvable JSON schema, or are 204 with no content", async () => {
    const { document, close } = await buildDocument();

    for (const { path, method } of ALL_OPERATIONS) {
      const label = `${method.toUpperCase()} ${path}`;
      const operation = getOperation(document, path, method);

      const responses = operation.responses;
      const successStatuses = Object.keys(responses).filter((status) => status.startsWith("2"));
      if (successStatuses.length === 0) {
        throw new Error(`${label} declares no 2xx response at all`);
      }

      for (const status of successStatuses) {
        const response = responses[status];
        const statusLabel = `${label} -> ${status}`;
        if (!response || "$ref" in response) {
          throw new Error(`${statusLabel} is missing or is an unresolved $ref`);
        }

        if (status === "204") {
          expect(response.content).toBeUndefined();
          continue;
        }

        if (!response.content) {
          throw new Error(`${statusLabel} has no content at all (the exact WEB-01A regression)`);
        }
        const jsonContent = response.content["application/json"];
        if (!jsonContent) throw new Error(`${statusLabel} has no application/json content`);
        if (!jsonContent.schema)
          throw new Error(`${statusLabel}'s application/json content has no schema`);
        // Confirms the schema is real and resolvable, never a dangling/never-typed placeholder.
        const resolved = resolveSchema(document, jsonContent.schema);
        if (!resolved) throw new Error(`${statusLabel}'s schema does not resolve to anything`);
      }
    }

    await close();
  });

  it("every operation carries the generic error contract under the OpenAPI 'default' response key", async () => {
    const { document, close } = await buildDocument();

    for (const { path, method } of ALL_OPERATIONS) {
      const operation = getOperation(document, path, method);
      const defaultResponse = operation.responses.default;
      if (!defaultResponse || "$ref" in defaultResponse) {
        throw new Error(`${method.toUpperCase()} ${path} has no default error response`);
      }
      const schema = defaultResponse.content?.["application/json"]?.schema;
      const properties = schema && "properties" in schema ? schema.properties : undefined;
      expect(properties?.statusCode).toBeDefined();
      expect(properties?.code).toBeDefined();
      expect(properties?.message).toBeDefined();
      expect(properties?.correlationId).toBeDefined();
    }

    await close();
  });

  describe("Auth contract (mandatory - brief section 6)", () => {
    it("login 200 describes accessToken/tokenType/expiresIn/user{id,email,displayName,status}", async () => {
      const { document, close } = await buildDocument();

      const operation = getOperation(document, "/api/v1/auth/login", "post");
      const response = operation.responses["200"];
      const schema = resolveSchema(
        document,
        response && !("$ref" in response)
          ? response.content?.["application/json"]?.schema
          : undefined,
      );
      expect(Object.keys(schema?.properties ?? {})).toEqual(
        expect.arrayContaining(["accessToken", "tokenType", "expiresIn", "user"]),
      );
      const userSchema = resolveSchema(document, schema?.properties?.user);
      expect(Object.keys(userSchema?.properties ?? {})).toEqual(
        expect.arrayContaining(["id", "email", "displayName", "status"]),
      );

      await close();
    });

    it("refresh 200 describes accessToken/tokenType/expiresIn", async () => {
      const { document, close } = await buildDocument();

      const operation = getOperation(document, "/api/v1/auth/refresh", "post");
      const response = operation.responses["200"];
      const schema = resolveSchema(
        document,
        response && !("$ref" in response)
          ? response.content?.["application/json"]?.schema
          : undefined,
      );
      expect(Object.keys(schema?.properties ?? {})).toEqual(
        expect.arrayContaining(["accessToken", "tokenType", "expiresIn"]),
      );

      await close();
    });

    it("logout 204 has no response body", async () => {
      const { document, close } = await buildDocument();

      const operation = getOperation(document, "/api/v1/auth/logout", "post");
      const response = operation.responses["204"];
      expect(response && !("$ref" in response) ? response.content : undefined).toBeUndefined();

      await close();
    });

    it("me 200 describes the profile fields plus a permissions array", async () => {
      const { document, close } = await buildDocument();

      const operation = getOperation(document, "/api/v1/auth/me", "get");
      const response = operation.responses["200"];
      const schema = resolveSchema(
        document,
        response && !("$ref" in response)
          ? response.content?.["application/json"]?.schema
          : undefined,
      );
      expect(Object.keys(schema?.properties ?? {})).toEqual(
        expect.arrayContaining([
          "id",
          "email",
          "displayName",
          "status",
          "createdAt",
          "lastLoginAt",
          "permissions",
        ]),
      );
      const permissionsSchema = schema?.properties?.permissions;
      const permissionsObj =
        permissionsSchema && !("$ref" in permissionsSchema) ? permissionsSchema : undefined;
      expect(permissionsObj?.type).toBe("array");
      const itemsSchema = permissionsObj?.items;
      expect(itemsSchema && !("$ref" in itemsSchema) ? itemsSchema.type : undefined).toBe("string");

      await close();
    });
  });

  describe("Business contract (representative coverage - brief section 23)", () => {
    it("customer list/get responses describe items[]/page/pageSize/total/totalPages", async () => {
      const { document, close } = await buildDocument();

      const operation = getOperation(document, "/api/v1/control-plane/customers", "get");
      const response = operation.responses["200"];
      const listSchema = resolveSchema(
        document,
        response && !("$ref" in response)
          ? response.content?.["application/json"]?.schema
          : undefined,
      );
      expect(Object.keys(listSchema?.properties ?? {})).toEqual(
        expect.arrayContaining(["items", "page", "pageSize", "total", "totalPages"]),
      );
      const itemsSchema = listSchema?.properties?.items;
      const itemsObj = itemsSchema && !("$ref" in itemsSchema) ? itemsSchema : undefined;
      expect(itemsObj?.type).toBe("array");
      const itemSchema = resolveSchema(document, itemsObj?.items);
      expect(Object.keys(itemSchema?.properties ?? {})).toEqual(
        expect.arrayContaining(["id", "code", "legalName", "status"]),
      );

      await close();
    });

    it("license get response describes entitlements as an array when present", async () => {
      const { document, close } = await buildDocument();

      const operation = getOperation(document, "/api/v1/control-plane/licenses/{id}", "get");
      const response = operation.responses["200"];
      const schema = resolveSchema(
        document,
        response && !("$ref" in response)
          ? response.content?.["application/json"]?.schema
          : undefined,
      );
      const entitlementsSchema = schema?.properties?.entitlements;
      const entitlementsObj =
        entitlementsSchema && !("$ref" in entitlementsSchema) ? entitlementsSchema : undefined;
      expect(entitlementsObj).toBeDefined();
      expect(entitlementsObj?.type).toBe("array");

      await close();
    });

    it("installation list response describes healthStatus/lastSeenAt per item", async () => {
      const { document, close } = await buildDocument();

      const operation = getOperation(document, "/api/v1/control-plane/installations", "get");
      const response = operation.responses["200"];
      const listSchema = resolveSchema(
        document,
        response && !("$ref" in response)
          ? response.content?.["application/json"]?.schema
          : undefined,
      );
      const itemsSchema = listSchema?.properties?.items;
      const itemsObj = itemsSchema && !("$ref" in itemsSchema) ? itemsSchema : undefined;
      const itemSchema = resolveSchema(document, itemsObj?.items);
      expect(Object.keys(itemSchema?.properties ?? {})).toEqual(
        expect.arrayContaining(["healthStatus", "lastSeenAt", "status", "platform"]),
      );

      await close();
    });

    it("installation health response describes lifecycleStatus/healthStatus/lastSeenAt", async () => {
      const { document, close } = await buildDocument();

      const operation = getOperation(
        document,
        "/api/v1/control-plane/installations/{id}/health",
        "get",
      );
      const response = operation.responses["200"];
      const schema = resolveSchema(
        document,
        response && !("$ref" in response)
          ? response.content?.["application/json"]?.schema
          : undefined,
      );
      expect(Object.keys(schema?.properties ?? {})).toEqual(
        expect.arrayContaining(["lifecycleStatus", "healthStatus", "lastSeenAt"]),
      );

      await close();
    });

    it("audit-events list response describes actor/action/resource/correlationId/metadata fields", async () => {
      const { document, close } = await buildDocument();

      const operation = getOperation(document, "/api/v1/control-plane/audit-events", "get");
      const response = operation.responses["200"];
      const listSchema = resolveSchema(
        document,
        response && !("$ref" in response)
          ? response.content?.["application/json"]?.schema
          : undefined,
      );
      const itemsSchema = listSchema?.properties?.items;
      const itemsObj = itemsSchema && !("$ref" in itemsSchema) ? itemsSchema : undefined;
      const itemSchema = resolveSchema(document, itemsObj?.items);
      expect(Object.keys(itemSchema?.properties ?? {})).toEqual(
        expect.arrayContaining([
          "actorType",
          "actorId",
          "action",
          "resourceType",
          "resourceId",
          "correlationId",
          "metadata",
          "occurredAt",
        ]),
      );

      await close();
    });

    it("machine enroll/session/heartbeat responses are documented (enroll/session typed, heartbeat 204)", async () => {
      const { document, close } = await buildDocument();

      const enrollOperation = getOperation(document, "/api/v1/installation-auth/enroll", "post");
      const enrollResponse = enrollOperation.responses["201"];
      const enrollSchema = resolveSchema(
        document,
        enrollResponse && !("$ref" in enrollResponse)
          ? enrollResponse.content?.["application/json"]?.schema
          : undefined,
      );
      expect(Object.keys(enrollSchema?.properties ?? {})).toEqual(
        expect.arrayContaining(["installationId", "credential"]),
      );

      const sessionOperation = getOperation(document, "/api/v1/installation-auth/session", "get");
      const sessionResponse = sessionOperation.responses["200"];
      const sessionSchema = resolveSchema(
        document,
        sessionResponse && !("$ref" in sessionResponse)
          ? sessionResponse.content?.["application/json"]?.schema
          : undefined,
      );
      expect(Object.keys(sessionSchema?.properties ?? {})).toEqual(
        expect.arrayContaining(["installationId"]),
      );

      const heartbeatOperation = getOperation(
        document,
        "/api/v1/installation-health/heartbeat",
        "post",
      );
      const heartbeatResponse = heartbeatOperation.responses["204"];
      expect(
        heartbeatResponse && !("$ref" in heartbeatResponse) ? heartbeatResponse.content : undefined,
      ).toBeUndefined();

      await close();
    });
  });
});
