import type { INestApplication } from "@nestjs/common";
import {
  ChangeInstallationStatusUseCase,
  CreateInstallationUseCase,
  EnrollInstallationUseCase,
  GetInstallationByIdUseCase,
  InstallationNotEligibleForEnrollmentError,
  InstallationNotFoundError,
  InstallationsModule,
  InstallationStatus,
  InvalidInstallationStatusTransitionError,
  IssueInstallationEnrollmentUseCase,
  LicenseCapacityExceededError,
  ListInstallationsUseCase,
  Platform,
  RevokeInstallationCredentialUseCase,
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
  let issueInstallationEnrollmentUseCase: { execute: jest.Mock };
  let revokeInstallationCredentialUseCase: { execute: jest.Mock };

  const customerId = "11111111-1111-4111-8111-111111111111";
  const licenseId = "22222222-2222-4222-8222-222222222222";

  beforeEach(async () => {
    createInstallationUseCase = { execute: jest.fn() };
    getInstallationByIdUseCase = { execute: jest.fn() };
    listInstallationsUseCase = { execute: jest.fn() };
    changeInstallationStatusUseCase = { execute: jest.fn() };
    issueInstallationEnrollmentUseCase = { execute: jest.fn() };
    revokeInstallationCredentialUseCase = { execute: jest.fn() };

    const moduleBuilder = createHttpTestModuleBuilder([InstallationsModule])
      .overrideProvider(CreateInstallationUseCase)
      .useValue(createInstallationUseCase)
      .overrideProvider(GetInstallationByIdUseCase)
      .useValue(getInstallationByIdUseCase)
      .overrideProvider(ListInstallationsUseCase)
      .useValue(listInstallationsUseCase)
      .overrideProvider(ChangeInstallationStatusUseCase)
      .useValue(changeInstallationStatusUseCase)
      .overrideProvider(IssueInstallationEnrollmentUseCase)
      .useValue(issueInstallationEnrollmentUseCase)
      .overrideProvider(RevokeInstallationCredentialUseCase)
      .useValue(revokeInstallationCredentialUseCase)
      .overrideProvider(EnrollInstallationUseCase)
      .useValue({ execute: jest.fn() });

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

  describe("POST /api/v1/control-plane/installations/:id/enrollment", () => {
    it("returns 201 with the one-time enrollmentCode for a PENDING installation", async () => {
      issueInstallationEnrollmentUseCase.execute.mockResolvedValue({
        installationId: "44444444-4444-4444-8444-444444444444",
        enrollmentCode: "enrollment-id.enrollment-secret",
        expiresAt: new Date("2026-01-01T00:15:00.000Z"),
      });

      const response = await request(app.getHttpServer()).post(
        "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/enrollment",
      );

      expect(response.status).toBe(201);
      expect(response.body.enrollmentCode).toBe("enrollment-id.enrollment-secret");
      expect(issueInstallationEnrollmentUseCase.execute).toHaveBeenCalledWith({
        installationId: "44444444-4444-4444-8444-444444444444",
        purpose: "INITIAL",
      });
    });

    it("returns 409 with the error contract when the installation is not eligible (not PENDING)", async () => {
      issueInstallationEnrollmentUseCase.execute.mockRejectedValue(
        new InstallationNotEligibleForEnrollmentError(
          "44444444-4444-4444-8444-444444444444",
          InstallationStatus.ACTIVE,
          "INITIAL" as never,
        ),
      );

      const response = await request(app.getHttpServer()).post(
        "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/enrollment",
      );

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("INSTALLATION_NOT_ELIGIBLE_FOR_ENROLLMENT");
    });

    it("returns 400 for an invalid UUID", async () => {
      const response = await request(app.getHttpServer()).post(
        "/api/v1/control-plane/installations/not-a-uuid/enrollment",
      );

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/v1/control-plane/installations/:id/credentials/recovery-enrollment", () => {
    it("returns 201 with the one-time enrollmentCode for an ACTIVE/SUSPENDED installation", async () => {
      issueInstallationEnrollmentUseCase.execute.mockResolvedValue({
        installationId: "44444444-4444-4444-8444-444444444444",
        enrollmentCode: "recovery-id.recovery-secret",
        expiresAt: new Date("2026-01-01T00:15:00.000Z"),
      });

      const response = await request(app.getHttpServer()).post(
        "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/credentials/recovery-enrollment",
      );

      expect(response.status).toBe(201);
      expect(issueInstallationEnrollmentUseCase.execute).toHaveBeenCalledWith({
        installationId: "44444444-4444-4444-8444-444444444444",
        purpose: "RECOVERY",
      });
    });

    it("returns 409 with the error contract when the installation is not eligible (PENDING/DECOMMISSIONED)", async () => {
      issueInstallationEnrollmentUseCase.execute.mockRejectedValue(
        new InstallationNotEligibleForEnrollmentError(
          "44444444-4444-4444-8444-444444444444",
          InstallationStatus.DECOMMISSIONED,
          "RECOVERY" as never,
        ),
      );

      const response = await request(app.getHttpServer()).post(
        "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/credentials/recovery-enrollment",
      );

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("INSTALLATION_NOT_ELIGIBLE_FOR_ENROLLMENT");
    });
  });

  describe("POST /api/v1/control-plane/installations/:id/credentials/revoke", () => {
    it("returns 204 (no body) on success", async () => {
      revokeInstallationCredentialUseCase.execute.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer()).post(
        "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/credentials/revoke",
      );

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });

    it("returns 204 even when there was no active credential (idempotent)", async () => {
      revokeInstallationCredentialUseCase.execute.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer()).post(
        "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/credentials/revoke",
      );

      expect(response.status).toBe(204);
    });

    it("returns 404 when the installation does not exist", async () => {
      revokeInstallationCredentialUseCase.execute.mockRejectedValue(
        new InstallationNotFoundError("44444444-4444-4444-8444-444444444444"),
      );

      const response = await request(app.getHttpServer()).post(
        "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/credentials/revoke",
      );

      expect(response.status).toBe(404);
    });
  });
});
