import { Global, Module, type INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { getDataSourceToken } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { AUTH_CONFIG, type AuthConfig } from "@pos-cloud/config";
import {
  AccessManagementModule,
  AccessTokenGuard,
  AdminAuthorizationGuard,
} from "@pos-cloud/access-management";
import {
  ChangeInstallationStatusUseCase,
  CreateInstallationUseCase,
  EnrollInstallationUseCase,
  EnrollmentFailedError,
  GetCustomerSummariesUseCase,
  GetInstallationByIdUseCase,
  GetInstallationHealthUseCase,
  GetLicenseSummariesUseCase,
  INSTALLATION_CREDENTIAL_VERIFIER,
  InstallationAuthGuard,
  InstallationsModule,
  InstallationStatus,
  IssueInstallationEnrollmentUseCase,
  ListInstallationsUseCase,
  RecordInstallationHeartbeatUseCase,
  RevokeInstallationCredentialUseCase,
  type InstallationCredentialVerifierPort,
} from "@pos-cloud/installations";
import request from "supertest";
import { createHttpTestModuleBuilder, initHttpTestApp } from "../test-support/http-test-app";

const fakeAuthConfig: AuthConfig = {
  jwt: { secret: "s".repeat(64), issuer: "pos-cloud", audience: "pos-cloud-admin" },
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  refreshCookieName: "pos_cloud_admin_refresh",
  secureCookies: false,
};

@Global()
@Module({ providers: [{ provide: AUTH_CONFIG, useValue: fakeAuthConfig }], exports: [AUTH_CONFIG] })
class TestAuthConfigModule {}

/**
 * Mirrors ControlPlaneModule's real 3-guard registration exactly (useExisting, order
 * AccessTokenGuard -> AdminAuthorizationGuard -> InstallationAuthGuard - see that module's own
 * comment). Imports both AccessManagementModule and InstallationsModule directly so `useExisting` can
 * resolve every guard's real, fully-wired instance.
 */
@Module({
  imports: [AccessManagementModule, InstallationsModule],
  providers: [
    { provide: APP_GUARD, useExisting: AccessTokenGuard },
    { provide: APP_GUARD, useExisting: AdminAuthorizationGuard },
    { provide: APP_GUARD, useExisting: InstallationAuthGuard },
  ],
})
class TestGlobalGuardsModule {}

async function signRealAdminAccessToken(adminUserId: string, sessionId: string): Promise<string> {
  const jwtService = new JwtService();
  return jwtService.signAsync(
    { sub: adminUserId, sid: sessionId, typ: "admin_access" },
    {
      secret: fakeAuthConfig.jwt.secret,
      issuer: fakeAuthConfig.jwt.issuer,
      audience: fakeAuthConfig.jwt.audience,
      expiresIn: fakeAuthConfig.accessTokenTtlSeconds,
      algorithm: "HS256",
    },
  );
}

/**
 * Exercises the real global guard chain (all 3, registered exactly as ControlPlaneModule registers
 * them) end-to-end against the machine identity plane - proving both the enrollment/session pipeline
 * itself and CLOUD-01C-C's core requirement that admin identity and installation identity are not
 * interchangeable (see docs/architecture/installation-enrollment.md#principles).
 */
describe("Installation Auth HTTP contract", () => {
  let app: INestApplication;
  let enrollInstallationUseCase: { execute: jest.Mock };
  let recordInstallationHeartbeatUseCase: { execute: jest.Mock };
  let verify: jest.Mock;

  beforeEach(async () => {
    enrollInstallationUseCase = { execute: jest.fn() };
    recordInstallationHeartbeatUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
    verify = jest.fn().mockResolvedValue(null);

    const verifier: InstallationCredentialVerifierPort = { verify };

    const moduleBuilder = createHttpTestModuleBuilder([
      TestAuthConfigModule,
      TestGlobalGuardsModule,
      AccessManagementModule,
      InstallationsModule,
    ])
      .overrideProvider(EnrollInstallationUseCase)
      .useValue(enrollInstallationUseCase)
      .overrideProvider(CreateInstallationUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(GetInstallationByIdUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ListInstallationsUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ChangeInstallationStatusUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(IssueInstallationEnrollmentUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(RevokeInstallationCredentialUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(GetInstallationHealthUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(RecordInstallationHeartbeatUseCase)
      .useValue(recordInstallationHeartbeatUseCase)
      .overrideProvider(GetCustomerSummariesUseCase)
      .useValue({ execute: jest.fn().mockResolvedValue(new Map()) })
      .overrideProvider(GetLicenseSummariesUseCase)
      .useValue({ execute: jest.fn().mockResolvedValue(new Map()) })
      .overrideProvider(INSTALLATION_CREDENTIAL_VERIFIER)
      .useValue(verifier);

    app = await initHttpTestApp(moduleBuilder);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/v1/installation-auth/enroll", () => {
    it("is reachable with no Authorization header at all - @InstallationEnrollment(), not @Public(), but still no Bearer required", async () => {
      enrollInstallationUseCase.execute.mockResolvedValue({
        installationId: "installation-1",
        credential: "credential-1.credential-secret",
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-auth/enroll")
        .send({ enrollmentCode: "enrollment-1.enrollment-secret" });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        installationId: "installation-1",
        credential: "credential-1.credential-secret",
      });
      expect(enrollInstallationUseCase.execute).toHaveBeenCalledWith(
        { enrollmentCode: "enrollment-1.enrollment-secret" },
        { correlationId: expect.any(String) },
      );
    });

    it("returns 401 ENROLLMENT_FAILED for any failure cause, never a distinguishing detail", async () => {
      enrollInstallationUseCase.execute.mockRejectedValue(new EnrollmentFailedError());

      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-auth/enroll")
        .send({ enrollmentCode: "bad.code" });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ statusCode: 401, code: "ENROLLMENT_FAILED" });
    });

    it("returns 400 for a missing enrollmentCode field", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-auth/enroll")
        .send({});

      expect(response.status).toBe(400);
      expect(enrollInstallationUseCase.execute).not.toHaveBeenCalled();
    });

    it("an admin Bearer token presented on this route is simply ignored - the endpoint never checks for one", async () => {
      const adminToken = await signRealAdminAccessToken("admin-1", "session-1");
      enrollInstallationUseCase.execute.mockResolvedValue({
        installationId: "installation-1",
        credential: "credential-1.credential-secret",
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-auth/enroll")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ enrollmentCode: "enrollment-1.enrollment-secret" });

      expect(response.status).toBe(201);
    });
  });

  describe("GET /api/v1/installation-auth/session", () => {
    it("returns 401 INSTALLATION_CREDENTIAL_INVALID with no Authorization header", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/installation-auth/session");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INSTALLATION_CREDENTIAL_INVALID");
      expect(verify).not.toHaveBeenCalled();
    });

    it("returns 401 INSTALLATION_CREDENTIAL_INVALID for a malformed Bearer value (no separator)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/installation-auth/session")
        .set("Authorization", "Bearer malformed-no-dot");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INSTALLATION_CREDENTIAL_INVALID");
      expect(verify).not.toHaveBeenCalled();
    });

    it("returns 401 INSTALLATION_CREDENTIAL_INVALID for an unknown/wrong credential", async () => {
      verify.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get("/api/v1/installation-auth/session")
        .set("Authorization", "Bearer credential-1.wrong-secret");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INSTALLATION_CREDENTIAL_INVALID");
      expect(verify).toHaveBeenCalledWith("credential-1", "wrong-secret");
    });

    it("returns 200 with installationId for a valid credential on an ACTIVE installation", async () => {
      verify.mockResolvedValue({
        installationId: "installation-1",
        installationStatus: InstallationStatus.ACTIVE,
      });

      const response = await request(app.getHttpServer())
        .get("/api/v1/installation-auth/session")
        .set("Authorization", "Bearer credential-1.correct-secret");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ installationId: "installation-1" });
    });

    it("returns 403 INSTALLATION_SUSPENDED for a valid credential on a SUSPENDED installation", async () => {
      verify.mockResolvedValue({
        installationId: "installation-1",
        installationStatus: InstallationStatus.SUSPENDED,
      });

      const response = await request(app.getHttpServer())
        .get("/api/v1/installation-auth/session")
        .set("Authorization", "Bearer credential-1.correct-secret");

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("INSTALLATION_SUSPENDED");
    });

    it("returns 403 INSTALLATION_DECOMMISSIONED for a valid credential on a DECOMMISSIONED installation", async () => {
      verify.mockResolvedValue({
        installationId: "installation-1",
        installationStatus: InstallationStatus.DECOMMISSIONED,
      });

      const response = await request(app.getHttpServer())
        .get("/api/v1/installation-auth/session")
        .set("Authorization", "Bearer credential-1.correct-secret");

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("INSTALLATION_DECOMMISSIONED");
    });
  });

  describe("POST /api/v1/installation-health/heartbeat", () => {
    it("returns 401 INSTALLATION_CREDENTIAL_INVALID with no Authorization header", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-health/heartbeat")
        .send({ appVersion: "1.4.2" });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INSTALLATION_CREDENTIAL_INVALID");
    });

    it("returns 401 INSTALLATION_CREDENTIAL_INVALID for a revoked/unknown credential", async () => {
      verify.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-health/heartbeat")
        .set("Authorization", "Bearer credential-1.wrong-secret")
        .send({ appVersion: "1.4.2" });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INSTALLATION_CREDENTIAL_INVALID");
    });

    it("returns 403 INSTALLATION_SUSPENDED for a valid credential on a SUSPENDED installation", async () => {
      verify.mockResolvedValue({
        installationId: "installation-1",
        installationStatus: InstallationStatus.SUSPENDED,
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-health/heartbeat")
        .set("Authorization", "Bearer credential-1.correct-secret")
        .send({ appVersion: "1.4.2" });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("INSTALLATION_SUSPENDED");
    });

    it("returns 403 INSTALLATION_DECOMMISSIONED for a valid credential on a DECOMMISSIONED installation", async () => {
      verify.mockResolvedValue({
        installationId: "installation-1",
        installationStatus: InstallationStatus.DECOMMISSIONED,
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-health/heartbeat")
        .set("Authorization", "Bearer credential-1.correct-secret")
        .send({ appVersion: "1.4.2" });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("INSTALLATION_DECOMMISSIONED");
    });

    it("an admin Bearer token is rejected (401 INSTALLATION_CREDENTIAL_INVALID) - identity cannot cross planes", async () => {
      const adminToken = await signRealAdminAccessToken("admin-1", "session-1");

      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-health/heartbeat")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ appVersion: "1.4.2" });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INSTALLATION_CREDENTIAL_INVALID");
    });

    it("returns 400 when appVersion is missing", async () => {
      verify.mockResolvedValue({
        installationId: "installation-1",
        installationStatus: InstallationStatus.ACTIVE,
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-health/heartbeat")
        .set("Authorization", "Bearer credential-1.correct-secret")
        .send({});

      expect(response.status).toBe(400);
    });

    it("returns 204 No Content for a valid credential on an ACTIVE installation, identity taken from the principal - a body-supplied installationId is ignored/rejected by the DTO", async () => {
      verify.mockResolvedValue({
        installationId: "installation-1",
        installationStatus: InstallationStatus.ACTIVE,
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-health/heartbeat")
        .set("Authorization", "Bearer credential-1.correct-secret")
        .send({ appVersion: "1.4.2" });

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(recordInstallationHeartbeatUseCase.execute).toHaveBeenCalledWith({
        installationId: "installation-1",
        appVersion: "1.4.2",
        clientReportedAt: null,
      });
    });

    it("returns 400 (forbidNonWhitelisted) when the body includes an installationId field - the DTO has no such property, so a spoofing attempt is rejected outright", async () => {
      verify.mockResolvedValue({
        installationId: "installation-1",
        installationStatus: InstallationStatus.ACTIVE,
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/installation-health/heartbeat")
        .set("Authorization", "Bearer credential-1.correct-secret")
        .send({ appVersion: "1.4.2", installationId: "some-other-installation" });

      expect(response.status).toBe(400);
    });
  });

  describe("identity separation - admin identity and installation identity are not interchangeable", () => {
    it("a real, valid admin access JWT is rejected on GET /installation-auth/session (401 INSTALLATION_CREDENTIAL_INVALID)", async () => {
      const adminToken = await signRealAdminAccessToken("admin-1", "session-1");

      const response = await request(app.getHttpServer())
        .get("/api/v1/installation-auth/session")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INSTALLATION_CREDENTIAL_INVALID");
    });

    it("an installation credential is rejected on an admin business route (401 INVALID_ACCESS_TOKEN, AccessTokenGuard never understood it as a JWT)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444")
        .set("Authorization", "Bearer credential-1.some-installation-secret");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_ACCESS_TOKEN");
    });

    it("an installation credential is rejected on GET /auth/me (same reason)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer credential-1.some-installation-secret");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_ACCESS_TOKEN");
    });
  });

  /**
   * Regression for CLOUD-01C-C's runtime validation finding: a malformed/non-UUID credential id
   * reached PostgreSQL as a raw query parameter against a `uuid` column and threw an uncaught
   * QueryFailedError (22P02), surfacing as 500 INTERNAL_ERROR instead of 401
   * INSTALLATION_CREDENTIAL_INVALID. The other describe blocks in this file override
   * INSTALLATION_CREDENTIAL_VERIFIER with a fake, so they exercise the guard's parsing/mapping logic
   * but never the real adapter - this block deliberately leaves the real
   * TypeOrmInstallationCredentialVerifierAdapter wired in, against a fake DataSource whose `query` is
   * directly observable, so it proves the fix at the actual layer that failed.
   */
  describe("GET /api/v1/installation-auth/session - real TypeORM adapter (malformed id regression)", () => {
    let realAdapterApp: INestApplication;
    let query: jest.Mock;

    beforeEach(async () => {
      query = jest.fn().mockResolvedValue([]);
      const fakeDataSource = {
        entityMetadatas: [],
        options: { type: "postgres" },
        getRepository: () => ({}),
        query,
      } as unknown as DataSource;

      const moduleBuilder = createHttpTestModuleBuilder([
        TestAuthConfigModule,
        TestGlobalGuardsModule,
        AccessManagementModule,
        InstallationsModule,
      ])
        .overrideProvider(EnrollInstallationUseCase)
        .useValue({ execute: jest.fn() })
        .overrideProvider(CreateInstallationUseCase)
        .useValue({ execute: jest.fn() })
        .overrideProvider(GetInstallationByIdUseCase)
        .useValue({ execute: jest.fn() })
        .overrideProvider(ListInstallationsUseCase)
        .useValue({ execute: jest.fn() })
        .overrideProvider(ChangeInstallationStatusUseCase)
        .useValue({ execute: jest.fn() })
        .overrideProvider(IssueInstallationEnrollmentUseCase)
        .useValue({ execute: jest.fn() })
        .overrideProvider(RevokeInstallationCredentialUseCase)
        .useValue({ execute: jest.fn() })
        .overrideProvider(GetInstallationHealthUseCase)
        .useValue({ execute: jest.fn() })
        .overrideProvider(GetCustomerSummariesUseCase)
        .useValue({ execute: jest.fn().mockResolvedValue(new Map()) })
        .overrideProvider(GetLicenseSummariesUseCase)
        .useValue({ execute: jest.fn().mockResolvedValue(new Map()) })
        .overrideProvider(getDataSourceToken())
        .useValue(fakeDataSource);
      // Deliberately NOT overriding INSTALLATION_CREDENTIAL_VERIFIER - the real
      // TypeOrmInstallationCredentialVerifierAdapter is constructed and wired for this block.

      realAdapterApp = await initHttpTestApp(moduleBuilder);
    });

    afterEach(async () => {
      await realAdapterApp.close();
    });

    it("returns 401 INSTALLATION_CREDENTIAL_INVALID, never 500, for a Bearer value whose id segment is not a UUID", async () => {
      const response = await request(realAdapterApp.getHttpServer())
        .get("/api/v1/installation-auth/session")
        .set("Authorization", "Bearer abc.def");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INSTALLATION_CREDENTIAL_INVALID");
      expect(query).not.toHaveBeenCalled();
    });

    it("returns 401 INSTALLATION_CREDENTIAL_INVALID, never 500, for a real admin access JWT presented as an installation Bearer", async () => {
      const adminToken = await signRealAdminAccessToken("admin-1", "session-1");

      const response = await request(realAdapterApp.getHttpServer())
        .get("/api/v1/installation-auth/session")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INSTALLATION_CREDENTIAL_INVALID");
      expect(query).not.toHaveBeenCalled();
    });

    it("still queries PostgreSQL and returns 401 INSTALLATION_CREDENTIAL_INVALID for a well-formed but unknown UUID id", async () => {
      const response = await request(realAdapterApp.getHttpServer())
        .get("/api/v1/installation-auth/session")
        .set("Authorization", "Bearer 11111111-1111-4111-8111-111111111111.some-secret");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INSTALLATION_CREDENTIAL_INVALID");
      expect(query).toHaveBeenCalledTimes(1);
    });
  });
});
