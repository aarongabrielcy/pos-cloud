import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  type INestApplication,
  Module,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import {
  ChangeLicenseStatusUseCase,
  CreateLicenseUseCase,
  GetCustomerSummariesUseCase,
  GetLicenseByIdUseCase,
  LicenseCustomerNotFoundError,
  LicenseEdition,
  LicenseModel,
  LicenseNotFoundError,
  LicenseNumberAlreadyExistsError,
  LicensingModule,
  LicenseStatus,
  ListLicensesUseCase,
  ReplaceLicenseEntitlementsUseCase,
} from "@pos-cloud/licensing";
import request from "supertest";
import { fakeCustomerSummary, fakeLicense } from "../test-support/fixtures";
import { createHttpTestModuleBuilder, initHttpTestApp } from "../test-support/http-test-app";

const STUB_ADMIN_ID = "test-admin-id";

/**
 * This file tests License HTTP/business behavior, not admin authentication/RBAC (that's
 * rbac-protection.http.spec.ts) - see customers.http.spec.ts's identical StubCurrentAdminGuard for
 * the full rationale.
 */
@Injectable()
class StubCurrentAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    request.currentAdmin = { adminUserId: STUB_ADMIN_ID, sessionId: "test-session-id" };
    return true;
  }
}

@Module({ providers: [{ provide: APP_GUARD, useClass: StubCurrentAdminGuard }] })
class StubCurrentAdminModule {}

describe("Licenses HTTP contract", () => {
  let app: INestApplication;
  let createLicenseUseCase: { execute: jest.Mock };
  let getLicenseByIdUseCase: { execute: jest.Mock };
  let listLicensesUseCase: { execute: jest.Mock };
  let changeLicenseStatusUseCase: { execute: jest.Mock };
  let replaceLicenseEntitlementsUseCase: { execute: jest.Mock };
  let getCustomerSummariesUseCase: { execute: jest.Mock };

  const customerId = "11111111-1111-4111-8111-111111111111";

  beforeEach(async () => {
    createLicenseUseCase = { execute: jest.fn() };
    getLicenseByIdUseCase = { execute: jest.fn() };
    listLicensesUseCase = { execute: jest.fn() };
    changeLicenseStatusUseCase = { execute: jest.fn() };
    replaceLicenseEntitlementsUseCase = { execute: jest.fn() };
    getCustomerSummariesUseCase = {
      execute: jest.fn().mockResolvedValue(new Map([[customerId, fakeCustomerSummary()]])),
    };

    const moduleBuilder = createHttpTestModuleBuilder([StubCurrentAdminModule, LicensingModule])
      .overrideProvider(CreateLicenseUseCase)
      .useValue(createLicenseUseCase)
      .overrideProvider(GetLicenseByIdUseCase)
      .useValue(getLicenseByIdUseCase)
      .overrideProvider(ListLicensesUseCase)
      .useValue(listLicensesUseCase)
      .overrideProvider(ChangeLicenseStatusUseCase)
      .useValue(changeLicenseStatusUseCase)
      .overrideProvider(ReplaceLicenseEntitlementsUseCase)
      .useValue(replaceLicenseEntitlementsUseCase)
      .overrideProvider(GetCustomerSummariesUseCase)
      .useValue(getCustomerSummariesUseCase);

    app = await initHttpTestApp(moduleBuilder);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/v1/control-plane/licenses", () => {
    it("returns 201 for a valid BASIC + PERPETUAL request", async () => {
      createLicenseUseCase.execute.mockResolvedValue(
        fakeLicense({ edition: LicenseEdition.BASIC, licenseModel: LicenseModel.PERPETUAL }),
      );

      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/licenses")
        .send({
          customerId,
          licenseNumber: "LIC-GST-00001",
          edition: LicenseEdition.BASIC,
          licenseModel: LicenseModel.PERPETUAL,
          validFrom: "2026-01-01T00:00:00.000Z",
          maxInstallations: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.edition).toBe(LicenseEdition.BASIC);
    });

    it("returns 201 for a valid PREMIUM + SUBSCRIPTION request", async () => {
      createLicenseUseCase.execute.mockResolvedValue(
        fakeLicense({ edition: LicenseEdition.PREMIUM, licenseModel: LicenseModel.SUBSCRIPTION }),
      );

      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/licenses")
        .send({
          customerId,
          licenseNumber: "LIC-GST-00002",
          edition: LicenseEdition.PREMIUM,
          licenseModel: LicenseModel.SUBSCRIPTION,
          validFrom: "2026-01-01T00:00:00.000Z",
          validUntil: "2027-01-01T00:00:00.000Z",
          maxInstallations: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.edition).toBe(LicenseEdition.PREMIUM);
    });

    it("returns 400 for an invalid customerId UUID", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/licenses")
        .send({
          customerId: "not-a-uuid",
          licenseNumber: "LIC-GST-00001",
          edition: LicenseEdition.BASIC,
          licenseModel: LicenseModel.PERPETUAL,
          validFrom: "2026-01-01T00:00:00.000Z",
          maxInstallations: 5,
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid edition", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/licenses")
        .send({
          customerId,
          licenseNumber: "LIC-GST-00001",
          edition: "GOLD",
          licenseModel: LicenseModel.PERPETUAL,
          validFrom: "2026-01-01T00:00:00.000Z",
          maxInstallations: 5,
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid licenseModel", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/licenses")
        .send({
          customerId,
          licenseNumber: "LIC-GST-00001",
          edition: LicenseEdition.BASIC,
          licenseModel: "LIFETIME",
          validFrom: "2026-01-01T00:00:00.000Z",
          maxInstallations: 5,
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for a non-ISO-8601 validFrom", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/licenses")
        .send({
          customerId,
          licenseNumber: "LIC-GST-00001",
          edition: LicenseEdition.BASIC,
          licenseModel: LicenseModel.PERPETUAL,
          validFrom: "not-a-date",
          maxInstallations: 5,
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 when maxInstallations is below 1", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/licenses")
        .send({
          customerId,
          licenseNumber: "LIC-GST-00001",
          edition: LicenseEdition.BASIC,
          licenseModel: LicenseModel.PERPETUAL,
          validFrom: "2026-01-01T00:00:00.000Z",
          maxInstallations: 0,
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for an unknown top-level property", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/licenses")
        .send({
          customerId,
          licenseNumber: "LIC-GST-00001",
          edition: LicenseEdition.BASIC,
          licenseModel: LicenseModel.PERPETUAL,
          validFrom: "2026-01-01T00:00:00.000Z",
          maxInstallations: 5,
          notAField: true,
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for an unknown entitlement property (nested DTO validation)", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/licenses")
        .send({
          customerId,
          licenseNumber: "LIC-GST-00001",
          edition: LicenseEdition.BASIC,
          licenseModel: LicenseModel.PERPETUAL,
          validFrom: "2026-01-01T00:00:00.000Z",
          maxInstallations: 5,
          entitlements: [{ code: "integrated_payments", enabled: true, notAField: true }],
        });

      expect(response.status).toBe(400);
    });

    it("returns 404 with the error contract when the customer does not exist", async () => {
      createLicenseUseCase.execute.mockRejectedValue(new LicenseCustomerNotFoundError(customerId));

      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/licenses")
        .send({
          customerId,
          licenseNumber: "LIC-GST-00001",
          edition: LicenseEdition.BASIC,
          licenseModel: LicenseModel.PERPETUAL,
          validFrom: "2026-01-01T00:00:00.000Z",
          maxInstallations: 5,
        });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("CUSTOMER_NOT_FOUND");
    });

    it("returns 409 with the error contract on a duplicate license number", async () => {
      createLicenseUseCase.execute.mockRejectedValue(
        new LicenseNumberAlreadyExistsError("LIC-GST-00001"),
      );

      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/licenses")
        .send({
          customerId,
          licenseNumber: "LIC-GST-00001",
          edition: LicenseEdition.BASIC,
          licenseModel: LicenseModel.PERPETUAL,
          validFrom: "2026-01-01T00:00:00.000Z",
          maxInstallations: 5,
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        statusCode: 409,
        code: "LICENSE_NUMBER_ALREADY_EXISTS",
        correlationId: expect.any(String),
      });
    });
  });

  describe("GET /api/v1/control-plane/licenses/:id", () => {
    it("returns 400 for an invalid UUID", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/licenses/not-a-uuid",
      );

      expect(response.status).toBe(400);
    });

    it("returns 404 when missing", async () => {
      getLicenseByIdUseCase.execute.mockResolvedValue(null);

      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/licenses/99999999-9999-4999-8999-999999999999",
      );

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("LICENSE_NOT_FOUND");
    });

    it("returns 200 with entitlements included", async () => {
      getLicenseByIdUseCase.execute.mockResolvedValue(fakeLicense());

      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222",
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.entitlements)).toBe(true);
    });

    it("includes the Customer display summary alongside the raw customerId (never replacing it)", async () => {
      getLicenseByIdUseCase.execute.mockResolvedValue(fakeLicense());

      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222",
      );

      expect(response.status).toBe(200);
      expect(response.body.customerId).toBe(customerId);
      expect(response.body.customer).toMatchObject({
        id: customerId,
        code: "GST-MX",
        legalName: "GS Trackme S.A. de C.V.",
      });
    });
  });

  describe("GET /api/v1/control-plane/licenses", () => {
    beforeEach(() => {
      listLicensesUseCase.execute.mockResolvedValue({
        items: [fakeLicense()],
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      });
    });

    it("returns 200 and omits entitlements per item", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/control-plane/licenses");

      expect(response.status).toBe(200);
      expect(response.body.items[0].entitlements).toBeUndefined();
    });

    it("includes the Customer display summary on each list item", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/control-plane/licenses");

      expect(response.status).toBe(200);
      expect(response.body.items[0].customer).toMatchObject({ id: customerId, code: "GST-MX" });
    });

    it("batches exactly ONE GetCustomerSummariesUseCase call for a page of many items - never one per row (no N+1)", async () => {
      const otherCustomerId = "33333333-3333-4333-8333-333333333333";
      listLicensesUseCase.execute.mockResolvedValue({
        items: [
          fakeLicense({ id: "a1111111-1111-4111-8111-111111111111", customerId }),
          fakeLicense({ id: "a2222222-2222-4222-8222-222222222222", customerId }),
          fakeLicense({ id: "a3333333-3333-4333-8333-333333333333", customerId: otherCustomerId }),
        ],
        page: 1,
        pageSize: 25,
        total: 3,
        totalPages: 1,
      });
      getCustomerSummariesUseCase.execute.mockResolvedValue(
        new Map([
          [customerId, fakeCustomerSummary()],
          [otherCustomerId, fakeCustomerSummary({ id: otherCustomerId, code: "ACME" })],
        ]),
      );

      const response = await request(app.getHttpServer()).get("/api/v1/control-plane/licenses");

      expect(response.status).toBe(200);
      expect(getCustomerSummariesUseCase.execute).toHaveBeenCalledTimes(1);
      // Deduplicated: 3 items, 2 distinct customerIds, still exactly one call with exactly those 2 ids.
      expect(getCustomerSummariesUseCase.execute).toHaveBeenCalledWith(
        expect.arrayContaining([customerId, otherCustomerId]),
      );
      expect((getCustomerSummariesUseCase.execute.mock.calls[0] as [string[]])[0]).toHaveLength(2);
      expect(response.body.items[0].customer.code).toBe("GST-MX");
      expect(response.body.items[2].customer.code).toBe("ACME");
    });

    it("returns 400 for an invalid pagination value", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/licenses?page=0",
      );

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid customerId filter", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/licenses?customerId=not-a-uuid",
      );

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid status filter", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/licenses?status=NOT_A_STATUS",
      );

      expect(response.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/control-plane/licenses/:id/status", () => {
    it("returns 200 for a valid status", async () => {
      changeLicenseStatusUseCase.execute.mockResolvedValue(
        fakeLicense({ status: LicenseStatus.SUSPENDED }),
      );

      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222/status")
        .send({ status: LicenseStatus.SUSPENDED });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(LicenseStatus.SUSPENDED);
    });

    it("returns 400 for an invalid status enum value", async () => {
      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222/status")
        .send({ status: "NOT_A_STATUS" });

      expect(response.status).toBe(400);
    });

    it("returns 404 when the license does not exist", async () => {
      changeLicenseStatusUseCase.execute.mockRejectedValue(
        new LicenseNotFoundError("22222222-2222-4222-8222-222222222222"),
      );

      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222/status")
        .send({ status: LicenseStatus.SUSPENDED });

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/v1/control-plane/licenses/:id/entitlements", () => {
    it("returns 200 for a valid entitlement collection", async () => {
      replaceLicenseEntitlementsUseCase.execute.mockResolvedValue(fakeLicense());

      const response = await request(app.getHttpServer())
        .put("/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222/entitlements")
        .send({
          entitlements: [
            { code: "integrated_payments", enabled: true, configuration: { provider: "x" } },
            { code: "cloud_backup", enabled: false },
          ],
        });

      expect(response.status).toBe(200);
      expect(replaceLicenseEntitlementsUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          licenseId: "22222222-2222-4222-8222-222222222222",
          entitlements: expect.arrayContaining([
            expect.objectContaining({ code: "integrated_payments" }),
          ]),
        }),
        { actorType: "ADMIN", actorId: STUB_ADMIN_ID, correlationId: expect.any(String) },
      );
    });

    it("accepts a null configuration", async () => {
      replaceLicenseEntitlementsUseCase.execute.mockResolvedValue(fakeLicense());

      const response = await request(app.getHttpServer())
        .put("/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222/entitlements")
        .send({ entitlements: [{ code: "cloud_backup", enabled: true, configuration: null }] });

      expect(response.status).toBe(200);
    });

    it("returns 400 when configuration is an array", async () => {
      const response = await request(app.getHttpServer())
        .put("/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222/entitlements")
        .send({ entitlements: [{ code: "cloud_backup", enabled: true, configuration: [] }] });

      expect(response.status).toBe(400);
    });

    it("returns 400 when configuration is a string", async () => {
      const response = await request(app.getHttpServer())
        .put("/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222/entitlements")
        .send({ entitlements: [{ code: "cloud_backup", enabled: true, configuration: "abc" }] });

      expect(response.status).toBe(400);
    });

    it("returns 400 for an unknown entitlement property", async () => {
      const response = await request(app.getHttpServer())
        .put("/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222/entitlements")
        .send({ entitlements: [{ code: "cloud_backup", enabled: true, notAField: 1 }] });

      expect(response.status).toBe(400);
    });
  });
});
