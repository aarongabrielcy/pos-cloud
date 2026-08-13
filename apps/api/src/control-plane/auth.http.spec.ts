import { Global, Module, type INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AUTH_CONFIG, type AuthConfig } from "@pos-cloud/config";
import {
  AccessManagementModule,
  AccessTokenGuard,
  AdminAuthorizationGuard,
  AdminUserNotFoundError,
  AdminUserStatus,
  GetAdminProfileUseCase,
  InvalidAdminCredentialsError,
  InvalidRefreshTokenError,
  LoginAdminUseCase,
  LogoutAdminUseCase,
  RefreshAdminSessionUseCase,
} from "@pos-cloud/access-management";
import request from "supertest";
import { createHttpTestModuleBuilder, initHttpTestApp } from "../test-support/http-test-app";

const fakeAuthConfig: AuthConfig = {
  jwt: { secret: "s".repeat(64), issuer: "pos-cloud", audience: "pos-cloud-admin" },
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  refreshCookieName: "pos_cloud_admin_refresh",
  secureCookies: false,
};

/**
 * AccessManagementModule expects AUTH_CONFIG to be supplied globally by the composition root (see
 * that module's own comment) - mirrors production's AuthConfigModule (apps/api/src/auth/
 * auth-config.module.ts), just with a fixed test value instead of loadAuthConfig().
 */
@Global()
@Module({ providers: [{ provide: AUTH_CONFIG, useValue: fakeAuthConfig }], exports: [AUTH_CONFIG] })
class TestAuthConfigModule {}

/**
 * CLOUD-01C-B: mirrors ControlPlaneModule's own APP_GUARD registration (AccessTokenGuard then
 * AdminAuthorizationGuard, both `useExisting` - see that module's own comment for why `useClass`
 * would fail to resolve ACCESS_TOKEN_VERIFIER/PERMISSION_RESOLVER here) so this HTTP contract test
 * exercises the real global guard chain instead of the old per-handler
 * `@UseGuards(AccessTokenGuard)` that used to sit directly on `me()`. Imports AccessManagementModule
 * directly (not just a sibling of it in the outer testing module) - `useExisting` needs the target
 * token visible to THIS module's own injector, exactly like ControlPlaneModule itself.
 */
@Module({
  imports: [AccessManagementModule],
  providers: [
    { provide: APP_GUARD, useExisting: AccessTokenGuard },
    { provide: APP_GUARD, useExisting: AdminAuthorizationGuard },
  ],
})
class TestGlobalGuardsModule {}

/** Issues a real access JWT the real AccessTokenGuard will accept, signed with fakeAuthConfig's own secret/issuer/audience. */
async function signRealAccessToken(adminUserId: string, sessionId: string): Promise<string> {
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

describe("Auth HTTP contract", () => {
  let app: INestApplication;
  let loginAdminUseCase: { execute: jest.Mock };
  let refreshAdminSessionUseCase: { execute: jest.Mock };
  let logoutAdminUseCase: { execute: jest.Mock };
  let getAdminProfileUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    loginAdminUseCase = { execute: jest.fn() };
    refreshAdminSessionUseCase = { execute: jest.fn() };
    logoutAdminUseCase = { execute: jest.fn() };
    getAdminProfileUseCase = { execute: jest.fn() };

    const moduleBuilder = createHttpTestModuleBuilder([
      TestAuthConfigModule,
      TestGlobalGuardsModule,
      AccessManagementModule,
    ])
      .overrideProvider(LoginAdminUseCase)
      .useValue(loginAdminUseCase)
      .overrideProvider(RefreshAdminSessionUseCase)
      .useValue(refreshAdminSessionUseCase)
      .overrideProvider(LogoutAdminUseCase)
      .useValue(logoutAdminUseCase)
      .overrideProvider(GetAdminProfileUseCase)
      .useValue(getAdminProfileUseCase);

    app = await initHttpTestApp(moduleBuilder);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/v1/auth/login", () => {
    it("returns 200, sets an HttpOnly refresh cookie, and never returns the refresh token in the body", async () => {
      loginAdminUseCase.execute.mockResolvedValue({
        accessToken: "fake-access-token",
        expiresInSeconds: 900,
        refreshToken: { sessionId: "session-1", secret: "super-secret-refresh-material" },
        user: {
          id: "admin-1",
          email: "admin@example.com",
          displayName: "Root Admin",
          status: AdminUserStatus.ACTIVE,
        },
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "admin@example.com", password: "correct-horse-battery-staple" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        accessToken: "fake-access-token",
        tokenType: "Bearer",
        expiresIn: 900,
        user: {
          id: "admin-1",
          email: "admin@example.com",
          displayName: "Root Admin",
          status: "ACTIVE",
        },
      });
      expect(JSON.stringify(response.body)).not.toContain("super-secret-refresh-material");

      const setCookie = response.headers["set-cookie"];
      expect(setCookie).toBeDefined();
      const cookie = (setCookie as unknown as string[]).find((c) =>
        c.startsWith("pos_cloud_admin_refresh="),
      );
      expect(cookie).toBeDefined();
      expect(cookie).toContain("session-1.super-secret-refresh-material");
      expect(cookie?.toLowerCase()).toContain("httponly");
      expect(cookie?.toLowerCase()).toContain("path=/api/v1/auth");
      expect(cookie?.toLowerCase()).not.toContain("secure");
    });

    it("returns 401 INVALID_CREDENTIALS for a wrong password", async () => {
      loginAdminUseCase.execute.mockRejectedValue(new InvalidAdminCredentialsError());

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "admin@example.com", password: "wrong-password-here" });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
        correlationId: expect.any(String),
      });
    });

    it("returns the same 401 INVALID_CREDENTIALS contract for an unknown email", async () => {
      loginAdminUseCase.execute.mockRejectedValue(new InvalidAdminCredentialsError());

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "nobody@example.com", password: "whatever-12345" });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_CREDENTIALS");
    });

    it("returns 400 for a malformed body (missing password)", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "admin@example.com" });

      expect(response.status).toBe(400);
      expect(loginAdminUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid email format", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "not-an-email", password: "whatever-12345" });

      expect(response.status).toBe(400);
    });

    it("is reachable with no Authorization header at all - @Public(), not merely unannotated", async () => {
      loginAdminUseCase.execute.mockRejectedValue(new InvalidAdminCredentialsError());

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "admin@example.com", password: "whatever-12345" });

      // 401 INVALID_CREDENTIALS from the use case, never 401 INVALID_ACCESS_TOKEN from the guard -
      // proves AccessTokenGuard never even ran its Bearer check for this route.
      expect(response.body.code).toBe("INVALID_CREDENTIALS");
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("returns 200 and rotates the refresh cookie", async () => {
      refreshAdminSessionUseCase.execute.mockResolvedValue({
        accessToken: "new-fake-access-token",
        expiresInSeconds: 900,
        refreshToken: { sessionId: "session-2", secret: "new-secret-material" },
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", ["pos_cloud_admin_refresh=session-1.old-secret-material"]);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        accessToken: "new-fake-access-token",
        tokenType: "Bearer",
        expiresIn: 900,
      });
      expect(refreshAdminSessionUseCase.execute).toHaveBeenCalledWith({
        rawRefreshToken: "session-1.old-secret-material",
      });
      const setCookie = response.headers["set-cookie"] as unknown as string[];
      expect(setCookie.some((c) => c.includes("session-2.new-secret-material"))).toBe(true);
    });

    it("returns 401 INVALID_REFRESH_TOKEN when no cookie is present", async () => {
      const response = await request(app.getHttpServer()).post("/api/v1/auth/refresh");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_REFRESH_TOKEN");
      expect(refreshAdminSessionUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 401 INVALID_REFRESH_TOKEN for an invalid token", async () => {
      refreshAdminSessionUseCase.execute.mockRejectedValue(new InvalidRefreshTokenError());

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", ["pos_cloud_admin_refresh=session-1.wrong-secret"]);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_REFRESH_TOKEN");
    });

    it("returns 401 INVALID_REFRESH_TOKEN when the same (already-rotated) token is reused", async () => {
      refreshAdminSessionUseCase.execute.mockRejectedValueOnce(new InvalidRefreshTokenError());

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", ["pos_cloud_admin_refresh=session-1.already-rotated-secret"]);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_REFRESH_TOKEN");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("returns 204 and clears the refresh cookie", async () => {
      logoutAdminUseCase.execute.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/logout")
        .set("Cookie", ["pos_cloud_admin_refresh=session-1.some-secret"]);

      expect(response.status).toBe(204);
      const setCookie = response.headers["set-cookie"] as unknown as string[];
      expect(setCookie.some((c) => c.startsWith("pos_cloud_admin_refresh=;"))).toBe(true);
    });

    it("is idempotent (204) with no cookie at all", async () => {
      logoutAdminUseCase.execute.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer()).post("/api/v1/auth/logout");

      expect(response.status).toBe(204);
      expect(logoutAdminUseCase.execute).toHaveBeenCalledWith({ rawRefreshToken: undefined });
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("returns 401 INVALID_ACCESS_TOKEN when no Authorization header is present", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/auth/me");

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        code: "INVALID_ACCESS_TOKEN",
        correlationId: expect.any(String),
      });
      expect(getAdminProfileUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 401 INVALID_ACCESS_TOKEN for a malformed/invalid Bearer token", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer not-a-real-jwt");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_ACCESS_TOKEN");
    });
  });

  describe("GET /api/v1/auth/me - authenticated", () => {
    let authedApp: INestApplication;
    let accessToken: string;

    beforeEach(async () => {
      accessToken = await signRealAccessToken("admin-1", "session-1");

      const moduleBuilder = createHttpTestModuleBuilder([
        TestAuthConfigModule,
        TestGlobalGuardsModule,
        AccessManagementModule,
      ])
        .overrideProvider(LoginAdminUseCase)
        .useValue(loginAdminUseCase)
        .overrideProvider(RefreshAdminSessionUseCase)
        .useValue(refreshAdminSessionUseCase)
        .overrideProvider(LogoutAdminUseCase)
        .useValue(logoutAdminUseCase)
        .overrideProvider(GetAdminProfileUseCase)
        .useValue(getAdminProfileUseCase);

      authedApp = await initHttpTestApp(moduleBuilder);
    });

    afterEach(async () => {
      await authedApp.close();
    });

    it("returns 200 with the public profile - never passwordHash", async () => {
      getAdminProfileUseCase.execute.mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        displayName: "Root Admin",
        status: AdminUserStatus.ACTIVE,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        lastLoginAt: null,
        permissions: ["audit.read", "customers.read"],
      });

      const response = await request(authedApp.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: "admin-1",
        email: "admin@example.com",
        displayName: "Root Admin",
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastLoginAt: null,
        permissions: ["audit.read", "customers.read"],
      });
      expect(getAdminProfileUseCase.execute).toHaveBeenCalledWith({ adminUserId: "admin-1" });
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    });

    it("returns 200 with status SUSPENDED for a suspended AdminUser (documents current policy - not a 401/403)", async () => {
      // A valid access JWT is not re-checked against AdminUser.status on every request (only
      // LoginAdminUseCase gates on canAttemptLogin - see CLOUD-01C-A's /auth/me inspection). This
      // test fixes that as the current, deliberately-unchanged behavior, not a new policy -
      // @AuthenticatedOnly() never resolves permissions, so AdminAuthorizationGuard cannot see
      // SUSPENDED here either (see docs/architecture/admin-rbac.md#suspended-semantics). The
      // GetAdminProfileUseCase-level PermissionResolverPort call is unaffected by this test's mock -
      // in production a SUSPENDED admin's resolver call would itself return an empty set (see
      // TypeOrmPermissionResolverAdapter), covered separately in that use case's own spec.
      getAdminProfileUseCase.execute.mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        displayName: "Root Admin",
        status: AdminUserStatus.SUSPENDED,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        lastLoginAt: null,
        permissions: [],
      });

      const response = await request(authedApp.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("SUSPENDED");
      expect(response.body.permissions).toEqual([]);
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    });

    it("returns 404 ADMIN_USER_NOT_FOUND when the authenticated AdminUser no longer exists (documents current behavior)", async () => {
      // A valid JWT only proves the token itself is genuine - GetAdminProfileUseCase still does a
      // fresh findById() every request, and AllExceptionsFilter maps NotFoundError to 404 generically
      // (it never special-cases "authenticated but the underlying identity is gone"). This fixes
      // today's real status/code so a future change to it is deliberate, not accidental.
      getAdminProfileUseCase.execute.mockRejectedValue(new AdminUserNotFoundError("admin-1"));

      const response = await request(authedApp.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ statusCode: 404, code: "ADMIN_USER_NOT_FOUND" });
    });
  });
});
