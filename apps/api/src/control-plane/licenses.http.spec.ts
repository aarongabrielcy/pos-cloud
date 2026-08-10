import type { INestApplication } from "@nestjs/common";
import {
  ChangeLicenseStatusUseCase,
  CreateLicenseUseCase,
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
import { fakeLicense } from "../test-support/fixtures";
import { createHttpTestModuleBuilder, initHttpTestApp } from "../test-support/http-test-app";

describe("Licenses HTTP contract", () => {
  let app: INestApplication;
  let createLicenseUseCase: { execute: jest.Mock };
  let getLicenseByIdUseCase: { execute: jest.Mock };
  let listLicensesUseCase: { execute: jest.Mock };
  let changeLicenseStatusUseCase: { execute: jest.Mock };
  let replaceLicenseEntitlementsUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    createLicenseUseCase = { execute: jest.fn() };
    getLicenseByIdUseCase = { execute: jest.fn() };
    listLicensesUseCase = { execute: jest.fn() };
    changeLicenseStatusUseCase = { execute: jest.fn() };
    replaceLicenseEntitlementsUseCase = { execute: jest.fn() };

    const moduleBuilder = createHttpTestModuleBuilder([LicensingModule])
      .overrideProvider(CreateLicenseUseCase)
      .useValue(createLicenseUseCase)
      .overrideProvider(GetLicenseByIdUseCase)
      .useValue(getLicenseByIdUseCase)
      .overrideProvider(ListLicensesUseCase)
      .useValue(listLicensesUseCase)
      .overrideProvider(ChangeLicenseStatusUseCase)
      .useValue(changeLicenseStatusUseCase)
      .overrideProvider(ReplaceLicenseEntitlementsUseCase)
      .useValue(replaceLicenseEntitlementsUseCase);

    app = await initHttpTestApp(moduleBuilder);
  });

  afterEach(async () => {
    await app.close();
  });

  const customerId = "11111111-1111-4111-8111-111111111111";

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
