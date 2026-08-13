import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  type INestApplication,
  Module,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuditModule, ListAuditEventsUseCase } from "@pos-cloud/audit";
import request from "supertest";
import { fakeAuditEvent } from "../test-support/fixtures";
import { createHttpTestModuleBuilder, initHttpTestApp } from "../test-support/http-test-app";

/**
 * This file tests the Audit HTTP/business behavior (pagination, filters, DTO validation,
 * append-only surface), not admin authentication/RBAC (that's the "audit.read - CLOUD-01C-D" block
 * in rbac-protection.http.spec.ts) - see customers.http.spec.ts's identical StubCurrentAdminGuard
 * for the full rationale.
 */
@Injectable()
class StubCurrentAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    request.currentAdmin = { adminUserId: "test-admin-id", sessionId: "test-session-id" };
    return true;
  }
}

@Module({ providers: [{ provide: APP_GUARD, useClass: StubCurrentAdminGuard }] })
class StubCurrentAdminModule {}

describe("Audit HTTP contract", () => {
  let app: INestApplication;
  let listAuditEventsUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    listAuditEventsUseCase = { execute: jest.fn() };

    const moduleBuilder = createHttpTestModuleBuilder([StubCurrentAdminModule, AuditModule])
      .overrideProvider(ListAuditEventsUseCase)
      .useValue(listAuditEventsUseCase);

    app = await initHttpTestApp(moduleBuilder);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/v1/control-plane/audit-events", () => {
    it("returns 200 with default pagination", async () => {
      listAuditEventsUseCase.execute.mockResolvedValue({
        items: [fakeAuditEvent()],
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      });

      const response = await request(app.getHttpServer()).get("/api/v1/control-plane/audit-events");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
      expect(response.body.items[0]).toMatchObject({
        action: "customer.created",
        resourceType: "Customer",
        actorType: "ADMIN",
      });
    });

    it("returns 400 for an invalid pageSize", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/audit-events?pageSize=0",
      );

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid actorType", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/audit-events?actorType=NOT_A_TYPE",
      );

      expect(response.status).toBe(400);
    });

    it("returns 400 for a non-ISO-8601 from/to", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/audit-events?from=not-a-date",
      );

      expect(response.status).toBe(400);
    });

    it("returns 400 for an unknown query parameter (forbidNonWhitelisted)", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/audit-events?notAField=1",
      );

      expect(response.status).toBe(400);
    });

    it("passes every filter through to the use case", async () => {
      listAuditEventsUseCase.execute.mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
      });

      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/audit-events" +
          "?actorType=ADMIN&actorId=admin-1&action=customer.created&resourceType=Customer" +
          "&resourceId=customer-1&correlationId=correlation-1" +
          "&from=2026-01-01T00:00:00.000Z&to=2026-01-02T00:00:00.000Z",
      );

      expect(response.status).toBe(200);
      expect(listAuditEventsUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: "ADMIN",
          actorId: "admin-1",
          action: "customer.created",
          resourceType: "Customer",
          resourceId: "customer-1",
          correlationId: "correlation-1",
          from: new Date("2026-01-01T00:00:00.000Z"),
          to: new Date("2026-01-02T00:00:00.000Z"),
        }),
      );
    });

    it("never exposes an update/delete route - GET is the only method on this resource", async () => {
      const patchResponse = await request(app.getHttpServer()).patch(
        "/api/v1/control-plane/audit-events/55555555-5555-4555-8555-555555555555",
      );
      const deleteResponse = await request(app.getHttpServer()).delete(
        "/api/v1/control-plane/audit-events/55555555-5555-4555-8555-555555555555",
      );

      expect(patchResponse.status).toBe(404);
      expect(deleteResponse.status).toBe(404);
    });
  });

  describe("error contract - 500", () => {
    it("sanitizes an unexpected error and never leaks internals", async () => {
      listAuditEventsUseCase.execute.mockRejectedValue(
        new Error("connection refused at 10.0.0.5:5432"),
      );

      const response = await request(app.getHttpServer()).get("/api/v1/control-plane/audit-events");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        statusCode: 500,
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        correlationId: expect.any(String),
      });
      expect(JSON.stringify(response.body)).not.toContain("10.0.0.5");
    });
  });
});
