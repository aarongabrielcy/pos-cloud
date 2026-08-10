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
});
