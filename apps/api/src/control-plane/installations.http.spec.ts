import type { INestApplication } from "@nestjs/common";
import {
  ChangeInstallationStatusUseCase,
  CreateInstallationUseCase,
  GetInstallationByIdUseCase,
  InstallationNotFoundError,
  InstallationsModule,
  InstallationStatus,
  InvalidInstallationStatusTransitionError,
  LicenseCapacityExceededError,
  ListInstallationsUseCase,
  Platform,
} from "@pos-cloud/installations";
import request from "supertest";
import { fakeInstallation } from "../test-support/fixtures";
import { createHttpTestModuleBuilder, initHttpTestApp } from "../test-support/http-test-app";

describe("Installations HTTP contract", () => {
  let app: INestApplication;
  let createInstallationUseCase: { execute: jest.Mock };
  let getInstallationByIdUseCase: { execute: jest.Mock };
  let listInstallationsUseCase: { execute: jest.Mock };
  let changeInstallationStatusUseCase: { execute: jest.Mock };

  const customerId = "11111111-1111-4111-8111-111111111111";
  const licenseId = "22222222-2222-4222-8222-222222222222";

  beforeEach(async () => {
    createInstallationUseCase = { execute: jest.fn() };
    getInstallationByIdUseCase = { execute: jest.fn() };
    listInstallationsUseCase = { execute: jest.fn() };
    changeInstallationStatusUseCase = { execute: jest.fn() };

    const moduleBuilder = createHttpTestModuleBuilder([InstallationsModule])
      .overrideProvider(CreateInstallationUseCase)
      .useValue(createInstallationUseCase)
      .overrideProvider(GetInstallationByIdUseCase)
      .useValue(getInstallationByIdUseCase)
      .overrideProvider(ListInstallationsUseCase)
      .useValue(listInstallationsUseCase)
      .overrideProvider(ChangeInstallationStatusUseCase)
      .useValue(changeInstallationStatusUseCase);

    app = await initHttpTestApp(moduleBuilder);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/v1/control-plane/installations", () => {
    it("returns 201 for a valid request", async () => {
      createInstallationUseCase.execute.mockResolvedValue(fakeInstallation());

      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/installations")
        .send({
          customerId,
          licenseId,
          installationCode: "POS-GST-00001",
          name: "Sucursal Principal",
          platform: Platform.WINDOWS,
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe(InstallationStatus.PENDING);
    });

    it("returns 400 for an invalid customerId UUID", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/installations")
        .send({
          customerId: "not-a-uuid",
          licenseId,
          installationCode: "POS-GST-00001",
          name: "Sucursal Principal",
          platform: Platform.WINDOWS,
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid licenseId UUID", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/installations")
        .send({
          customerId,
          licenseId: "not-a-uuid",
          installationCode: "POS-GST-00001",
          name: "Sucursal Principal",
          platform: Platform.WINDOWS,
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid platform", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/installations")
        .send({
          customerId,
          licenseId,
          installationCode: "POS-GST-00001",
          name: "Sucursal Principal",
          platform: "LINUX",
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 when installationCode exceeds the DTO's maximum length", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/installations")
        .send({
          customerId,
          licenseId,
          installationCode: "P".repeat(81),
          name: "Sucursal Principal",
          platform: Platform.WINDOWS,
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for an unknown top-level property", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/installations")
        .send({
          customerId,
          licenseId,
          installationCode: "POS-GST-00001",
          name: "Sucursal Principal",
          platform: Platform.WINDOWS,
          notAField: true,
        });

      expect(response.status).toBe(400);
    });

    it("returns 409 with the error contract when license capacity is exceeded", async () => {
      createInstallationUseCase.execute.mockRejectedValue(
        new LicenseCapacityExceededError(licenseId, 5),
      );

      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/installations")
        .send({
          customerId,
          licenseId,
          installationCode: "POS-GST-00001",
          name: "Sucursal Principal",
          platform: Platform.WINDOWS,
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        statusCode: 409,
        code: "LICENSE_CAPACITY_EXCEEDED",
        correlationId: expect.any(String),
      });
    });
  });

  describe("GET /api/v1/control-plane/installations/:id", () => {
    it("returns 400 for an invalid UUID", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/installations/not-a-uuid",
      );

      expect(response.status).toBe(400);
    });

    it("returns 404 when missing", async () => {
      getInstallationByIdUseCase.execute.mockResolvedValue(null);

      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/installations/99999999-9999-4999-8999-999999999999",
      );

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("INSTALLATION_NOT_FOUND");
    });

    it("returns 200 for a valid UUID", async () => {
      getInstallationByIdUseCase.execute.mockResolvedValue(fakeInstallation());

      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444",
      );

      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/v1/control-plane/installations", () => {
    beforeEach(() => {
      listInstallationsUseCase.execute.mockResolvedValue({
        items: [fakeInstallation()],
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      });
    });

    it("returns 200 with default pagination", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/installations",
      );

      expect(response.status).toBe(200);
    });

    it("returns 400 for an invalid pageSize", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/installations?pageSize=0",
      );

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid licenseId filter", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/installations?licenseId=not-a-uuid",
      );

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid platform filter", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/installations?platform=LINUX",
      );

      expect(response.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/control-plane/installations/:id/status", () => {
    it("returns 200 for a valid admin transition (e.g. ACTIVE -> SUSPENDED)", async () => {
      changeInstallationStatusUseCase.execute.mockResolvedValue(
        fakeInstallation({ status: InstallationStatus.SUSPENDED }),
      );

      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/status")
        .send({ status: InstallationStatus.SUSPENDED });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(InstallationStatus.SUSPENDED);
    });

    it("returns 400 for an invalid status enum value", async () => {
      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/status")
        .send({ status: "NOT_A_STATUS" });

      expect(response.status).toBe(400);
    });

    it("returns 400 with the error contract on an invalid business transition (PENDING -> ACTIVE is admin-blocked)", async () => {
      changeInstallationStatusUseCase.execute.mockRejectedValue(
        new InvalidInstallationStatusTransitionError(
          InstallationStatus.PENDING,
          InstallationStatus.ACTIVE,
        ),
      );

      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/status")
        .send({ status: InstallationStatus.ACTIVE });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_INSTALLATION_STATUS_TRANSITION");
    });

    it("returns 404 when the installation does not exist", async () => {
      changeInstallationStatusUseCase.execute.mockRejectedValue(
        new InstallationNotFoundError("44444444-4444-4444-8444-444444444444"),
      );

      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/status")
        .send({ status: InstallationStatus.SUSPENDED });

      expect(response.status).toBe(404);
    });
  });
});
