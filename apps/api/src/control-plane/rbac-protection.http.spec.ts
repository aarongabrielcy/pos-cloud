import { Global, Module, type INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AUTH_CONFIG, type AuthConfig } from "@pos-cloud/config";
import {
  AccessManagementModule,
  AccessTokenGuard,
  AdminAuthorizationGuard,
  PERMISSION_RESOLVER,
  type PermissionCode,
} from "@pos-cloud/access-management";
import {
  ChangeCustomerStatusUseCase,
  CreateCustomerUseCase,
  CustomerManagementModule,
  GetCustomerByIdUseCase,
  ListCustomersUseCase,
} from "@pos-cloud/customer-management";
import {
  ChangeInstallationStatusUseCase,
  CreateInstallationUseCase,
  EnrollInstallationUseCase,
  GetCustomerSummariesUseCase as InstallationsGetCustomerSummariesUseCase,
  GetInstallationByIdUseCase,
  GetInstallationHealthUseCase,
  GetLicenseSummariesUseCase,
  InstallationsModule,
  IssueInstallationEnrollmentUseCase,
  ListInstallationsUseCase,
  RevokeInstallationCredentialUseCase,
} from "@pos-cloud/installations";
import {
  ChangeLicenseStatusUseCase,
  CreateLicenseUseCase,
  GetCustomerSummariesUseCase as LicensingGetCustomerSummariesUseCase,
  GetLicenseByIdUseCase,
  LicensingModule,
  ListLicensesUseCase,
  ReplaceLicenseEntitlementsUseCase,
} from "@pos-cloud/licensing";
import { AuditModule, ListAuditEventsUseCase } from "@pos-cloud/audit";
import request from "supertest";
import {
  fakeCustomer,
  fakeCustomerSummary,
  fakeInstallation,
  fakeLicense,
  fakeLicenseSummary,
} from "../test-support/fixtures";
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
 * Mirrors ControlPlaneModule's real APP_GUARD registration exactly (useExisting, not useClass - see
 * that module's own comment) - imports AccessManagementModule directly so `useExisting` can resolve
 * the already-wired guard instances.
 */
@Module({
  imports: [AccessManagementModule],
  providers: [
    { provide: APP_GUARD, useExisting: AccessTokenGuard },
    { provide: APP_GUARD, useExisting: AdminAuthorizationGuard },
  ],
})
class TestGlobalGuardsModule {}

async function signAccessToken(adminUserId: string): Promise<string> {
  const jwtService = new JwtService();
  return jwtService.signAsync(
    { sub: adminUserId, sid: "session-1", typ: "admin_access" },
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
 * Exercises the real global guard chain (AccessTokenGuard -> AdminAuthorizationGuard, registered
 * exactly as ControlPlaneModule registers them) end-to-end against one representative endpoint per
 * business bounded context, proving CLOUD-01C-B's protection matrix without repeating all 13
 * endpoints x every role combination (see docs/architecture/admin-rbac.md#test-strategy;
 * rbac-protection-matrix.spec.ts covers the full 13-endpoint metadata, default-deny.meta.spec.ts
 * covers every handler having a classification at all).
 *
 * PERMISSION_RESOLVER is overridden with a plain jest mock instead of hitting PostgreSQL - real
 * resolver behavior (the join query, the ACTIVE-status filter, unknown-code handling) is covered by
 * typeorm-permission-resolver.adapter.spec.ts. Access tokens are real, signed JWTs (not a bypassed
 * guard) so this also proves AccessTokenGuard's own logic runs first.
 */
describe("RBAC Control Plane protection (HTTP)", () => {
  let app: INestApplication;
  let resolveEffectivePermissions: jest.Mock;
  let createCustomerUseCase: { execute: jest.Mock };
  let getCustomerByIdUseCase: { execute: jest.Mock };
  let replaceLicenseEntitlementsUseCase: { execute: jest.Mock };
  let changeInstallationStatusUseCase: { execute: jest.Mock };
  let issueInstallationEnrollmentUseCase: { execute: jest.Mock };
  let revokeInstallationCredentialUseCase: { execute: jest.Mock };
  let listAuditEventsUseCase: { execute: jest.Mock };

  function grant(adminUserId: string, ...codes: PermissionCode[]): void {
    resolveEffectivePermissions.mockImplementation((id: string) =>
      Promise.resolve(id === adminUserId ? new Set(codes) : new Set()),
    );
  }

  beforeEach(async () => {
    resolveEffectivePermissions = jest.fn().mockResolvedValue(new Set());
    createCustomerUseCase = { execute: jest.fn() };
    getCustomerByIdUseCase = { execute: jest.fn() };
    replaceLicenseEntitlementsUseCase = { execute: jest.fn() };
    changeInstallationStatusUseCase = { execute: jest.fn() };
    issueInstallationEnrollmentUseCase = { execute: jest.fn() };
    revokeInstallationCredentialUseCase = { execute: jest.fn() };
    listAuditEventsUseCase = { execute: jest.fn() };

    const moduleBuilder = createHttpTestModuleBuilder([
      TestAuthConfigModule,
      TestGlobalGuardsModule,
      AccessManagementModule,
      CustomerManagementModule,
      LicensingModule,
      InstallationsModule,
      AuditModule,
    ])
      .overrideProvider(PERMISSION_RESOLVER)
      .useValue({ resolveEffectivePermissions })
      // Every use case each controller's constructor needs, not just the ones a given test drives -
      // otherwise Nest tries to construct the REAL use case (e.g. CreateLicenseUseCase), which needs
      // cross-context reader ports only CrossContextPortsModule provides in the real app (see
      // customers.http.spec.ts/licenses.http.spec.ts/installations.http.spec.ts for the same full
      // per-controller override list this mirrors).
      .overrideProvider(CreateCustomerUseCase)
      .useValue(createCustomerUseCase)
      .overrideProvider(GetCustomerByIdUseCase)
      .useValue(getCustomerByIdUseCase)
      .overrideProvider(ListCustomersUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ChangeCustomerStatusUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(CreateLicenseUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(GetLicenseByIdUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ListLicensesUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ChangeLicenseStatusUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ReplaceLicenseEntitlementsUseCase)
      .useValue(replaceLicenseEntitlementsUseCase)
      .overrideProvider(LicensingGetCustomerSummariesUseCase)
      .useValue({
        execute: jest
          .fn()
          .mockResolvedValue(
            new Map([["11111111-1111-4111-8111-111111111111", fakeCustomerSummary()]]),
          ),
      })
      .overrideProvider(CreateInstallationUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(GetInstallationByIdUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ListInstallationsUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ChangeInstallationStatusUseCase)
      .useValue(changeInstallationStatusUseCase)
      .overrideProvider(IssueInstallationEnrollmentUseCase)
      .useValue(issueInstallationEnrollmentUseCase)
      .overrideProvider(RevokeInstallationCredentialUseCase)
      .useValue(revokeInstallationCredentialUseCase)
      .overrideProvider(EnrollInstallationUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(GetInstallationHealthUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(InstallationsGetCustomerSummariesUseCase)
      .useValue({
        execute: jest
          .fn()
          .mockResolvedValue(
            new Map([["11111111-1111-4111-8111-111111111111", fakeCustomerSummary()]]),
          ),
      })
      .overrideProvider(GetLicenseSummariesUseCase)
      .useValue({
        execute: jest
          .fn()
          .mockResolvedValue(
            new Map([["22222222-2222-4222-8222-222222222222", fakeLicenseSummary()]]),
          ),
      })
      .overrideProvider(ListAuditEventsUseCase)
      .useValue(listAuditEventsUseCase);

    app = await initHttpTestApp(moduleBuilder);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("guard order: authentication before authorization", () => {
    it("returns 401 INVALID_ACCESS_TOKEN (not 403) for a protected endpoint with no Authorization header", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111",
      );

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_ACCESS_TOKEN");
      expect(resolveEffectivePermissions).not.toHaveBeenCalled();
    });

    it("returns 401 INVALID_ACCESS_TOKEN (not 403) for a malformed Bearer token", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111")
        .set("Authorization", "Bearer not-a-real-jwt");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_ACCESS_TOKEN");
    });
  });

  describe("authenticated but missing the required permission", () => {
    it("returns 403 FORBIDDEN when the admin has zero effective permissions", async () => {
      const token = await signAccessToken("admin-no-permissions");

      const response = await request(app.getHttpServer())
        .get("/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
      expect(getCustomerByIdUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 403 FORBIDDEN when the admin has an unrelated permission, not the one required", async () => {
      const token = await signAccessToken("admin-wrong-permission");
      grant("admin-wrong-permission", "installations.read");

      const response = await request(app.getHttpServer())
        .get("/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });

  describe("authenticated with the required permission", () => {
    it("executes the handler (200) once the admin has customers.read", async () => {
      const token = await signAccessToken("admin-with-read");
      grant("admin-with-read", "customers.read");
      getCustomerByIdUseCase.execute.mockResolvedValue(fakeCustomer());

      const response = await request(app.getHttpServer())
        .get("/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(getCustomerByIdUseCase.execute).toHaveBeenCalled();
    });
  });

  describe("PLATFORM_VIEWER role shape (read allowed, write forbidden)", () => {
    it("allows GET (customers.read granted)", async () => {
      const token = await signAccessToken("admin-viewer");
      grant("admin-viewer", "customers.read", "licenses.read", "installations.read");
      getCustomerByIdUseCase.execute.mockResolvedValue(fakeCustomer());

      const response = await request(app.getHttpServer())
        .get("/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("forbids POST (customers.create not granted)", async () => {
      const token = await signAccessToken("admin-viewer");
      grant("admin-viewer", "customers.read", "licenses.read", "installations.read");

      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/customers")
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "GST-MX", legalName: "GS Trackme S.A. de C.V." });

      expect(response.status).toBe(403);
      expect(createCustomerUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe("PLATFORM_OPERATOR role shape (normal ops allowed, entitlements.manage forbidden)", () => {
    it("allows a normal write operation (customers.create granted)", async () => {
      const token = await signAccessToken("admin-operator");
      grant(
        "admin-operator",
        "customers.read",
        "customers.create",
        "customers.status.change",
        "licenses.read",
        "licenses.create",
        "licenses.status.change",
        "installations.read",
        "installations.create",
        "installations.status.change",
      );
      createCustomerUseCase.execute.mockResolvedValue(fakeCustomer());

      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/customers")
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "GST-MX", legalName: "GS Trackme S.A. de C.V." });

      expect(response.status).toBe(201);
    });

    it("forbids licenses.entitlements.manage - the one permission PLATFORM_OPERATOR deliberately lacks", async () => {
      const token = await signAccessToken("admin-operator");
      grant(
        "admin-operator",
        "customers.read",
        "customers.create",
        "customers.status.change",
        "licenses.read",
        "licenses.create",
        "licenses.status.change",
        "installations.read",
        "installations.create",
        "installations.status.change",
      );

      const response = await request(app.getHttpServer())
        .put("/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222/entitlements")
        .set("Authorization", `Bearer ${token}`)
        .send({ entitlements: [] });

      expect(response.status).toBe(403);
      expect(replaceLicenseEntitlementsUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe("PLATFORM_ADMIN role shape (every current operation allowed)", () => {
    it("allows licenses.entitlements.manage", async () => {
      const token = await signAccessToken("admin-platform-admin");
      grant("admin-platform-admin", "licenses.entitlements.manage");
      replaceLicenseEntitlementsUseCase.execute.mockResolvedValue(fakeLicense());

      const response = await request(app.getHttpServer())
        .put("/api/v1/control-plane/licenses/22222222-2222-4222-8222-222222222222/entitlements")
        .set("Authorization", `Bearer ${token}`)
        .send({ entitlements: [] });

      expect(response.status).toBe(200);
    });

    it("allows installations.status.change", async () => {
      const token = await signAccessToken("admin-platform-admin");
      grant("admin-platform-admin", "installations.status.change");
      changeInstallationStatusUseCase.execute.mockResolvedValue(fakeInstallation());

      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "SUSPENDED" });

      expect(response.status).toBe(200);
    });

    it("allows installations.credentials.manage (revoke)", async () => {
      const token = await signAccessToken("admin-platform-admin");
      grant("admin-platform-admin", "installations.credentials.manage");
      revokeInstallationCredentialUseCase.execute.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post(
          "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/credentials/revoke",
        )
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(204);
    });
  });

  describe("installations.enrollment.manage vs installations.credentials.manage - CLOUD-01C-C role separation", () => {
    it("PLATFORM_OPERATOR can issue an initial enrollment code", async () => {
      const token = await signAccessToken("admin-operator-enrollment");
      grant("admin-operator-enrollment", "installations.enrollment.manage");
      issueInstallationEnrollmentUseCase.execute.mockResolvedValue({
        installationId: "44444444-4444-4444-8444-444444444444",
        enrollmentCode: "id.secret",
        expiresAt: new Date("2026-01-01T00:15:00.000Z"),
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/enrollment")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(201);
    });

    it("PLATFORM_OPERATOR is forbidden from revoking a credential - installations.credentials.manage is PLATFORM_ADMIN-only", async () => {
      const token = await signAccessToken("admin-operator-no-credentials");
      grant("admin-operator-no-credentials", "installations.enrollment.manage");

      const response = await request(app.getHttpServer())
        .post(
          "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/credentials/revoke",
        )
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(revokeInstallationCredentialUseCase.execute).not.toHaveBeenCalled();
    });

    it("PLATFORM_OPERATOR is forbidden from issuing a recovery enrollment - installations.credentials.manage is PLATFORM_ADMIN-only", async () => {
      const token = await signAccessToken("admin-operator-no-recovery");
      grant("admin-operator-no-recovery", "installations.enrollment.manage");

      const response = await request(app.getHttpServer())
        .post(
          "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/credentials/recovery-enrollment",
        )
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(issueInstallationEnrollmentUseCase.execute).not.toHaveBeenCalled();
    });

    it("PLATFORM_ADMIN can issue a recovery enrollment", async () => {
      const token = await signAccessToken("admin-platform-admin-recovery");
      grant("admin-platform-admin-recovery", "installations.credentials.manage");
      issueInstallationEnrollmentUseCase.execute.mockResolvedValue({
        installationId: "44444444-4444-4444-8444-444444444444",
        enrollmentCode: "id.secret",
        expiresAt: new Date("2026-01-01T00:15:00.000Z"),
      });

      const response = await request(app.getHttpServer())
        .post(
          "/api/v1/control-plane/installations/44444444-4444-4444-8444-444444444444/credentials/recovery-enrollment",
        )
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(201);
    });
  });

  describe("audit.read - CLOUD-01C-D", () => {
    it("PLATFORM_VIEWER's read-only permissions do not include audit.read - forbidden", async () => {
      const token = await signAccessToken("admin-viewer-audit");
      grant("admin-viewer-audit", "customers.read", "licenses.read", "installations.read");

      const response = await request(app.getHttpServer())
        .get("/api/v1/control-plane/audit-events")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(listAuditEventsUseCase.execute).not.toHaveBeenCalled();
    });

    it("PLATFORM_OPERATOR can read audit events", async () => {
      const token = await signAccessToken("admin-operator-audit");
      grant("admin-operator-audit", "audit.read");
      listAuditEventsUseCase.execute.mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
      });

      const response = await request(app.getHttpServer())
        .get("/api/v1/control-plane/audit-events")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("PLATFORM_ADMIN can read audit events", async () => {
      const token = await signAccessToken("admin-platform-admin-audit");
      grant("admin-platform-admin-audit", "audit.read");
      listAuditEventsUseCase.execute.mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
      });

      const response = await request(app.getHttpServer())
        .get("/api/v1/control-plane/audit-events")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });
  });

  describe("SUSPENDED AdminUser with a still-valid access JWT and PLATFORM_ADMIN assigned", () => {
    it("returns 403 on a business endpoint - simulates exactly what TypeOrmPermissionResolverAdapter's own ACTIVE-status filter returns for a SUSPENDED admin: empty set despite having every role", async () => {
      const token = await signAccessToken("admin-suspended-with-platform-admin-role");
      // Deliberately NOT granted - this is the resolver's real behavior for SUSPENDED (see
      // TypeOrmPermissionResolverAdapter's own WHERE au.status = 'ACTIVE' clause and spec), not a
      // guard-level special case.

      const response = await request(app.getHttpServer())
        .get("/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
    });
  });
});
