import { ConfigValidationError } from "./config-validation.error";
import { loadAuthConfig } from "./load-auth-config";

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  AUTH_JWT_SECRET: "a".repeat(64),
  AUTH_JWT_ISSUER: "pos-cloud",
  AUTH_JWT_AUDIENCE: "pos-cloud-admin",
  AUTH_ACCESS_TOKEN_TTL_SECONDS: "900",
  AUTH_REFRESH_TOKEN_TTL_SECONDS: "604800",
  AUTH_REFRESH_COOKIE_NAME: "pos_cloud_admin_refresh",
};

describe("loadAuthConfig", () => {
  it("accepts a fully valid environment and returns a typed AuthConfig", () => {
    const config = loadAuthConfig(validEnv);

    expect(config).toEqual({
      jwt: {
        secret: "a".repeat(64),
        issuer: "pos-cloud",
        audience: "pos-cloud-admin",
      },
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 604800,
      refreshCookieName: "pos_cloud_admin_refresh",
      secureCookies: false,
    });
  });

  it("sets secureCookies to true only when NODE_ENV=production", () => {
    expect(loadAuthConfig({ ...validEnv, NODE_ENV: "production" }).secureCookies).toBe(true);
    expect(loadAuthConfig({ ...validEnv, NODE_ENV: "development" }).secureCookies).toBe(false);
    expect(loadAuthConfig({ ...validEnv, NODE_ENV: "staging" }).secureCookies).toBe(false);
  });

  it("fails fast when AUTH_JWT_SECRET is missing", () => {
    const { AUTH_JWT_SECRET: _omit, ...withoutSecret } = validEnv;

    expect(() => loadAuthConfig(withoutSecret)).toThrow(ConfigValidationError);
  });

  it("fails fast when AUTH_JWT_SECRET is shorter than 32 characters", () => {
    const invalidEnv = { ...validEnv, AUTH_JWT_SECRET: "too-short" };

    expect(() => loadAuthConfig(invalidEnv)).toThrow(ConfigValidationError);
  });

  it("does not leak the secret value in the error message", () => {
    const invalidEnv = { ...validEnv, AUTH_JWT_SECRET: "short" };

    expect.assertions(2);
    let caught: unknown;
    try {
      loadAuthConfig(invalidEnv);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConfigValidationError);
    expect((caught as Error).message).not.toContain("short");
  });

  it("applies safe defaults for optional variables", () => {
    const {
      NODE_ENV: _env,
      AUTH_JWT_ISSUER: _issuer,
      AUTH_JWT_AUDIENCE: _audience,
      AUTH_ACCESS_TOKEN_TTL_SECONDS: _accessTtl,
      AUTH_REFRESH_TOKEN_TTL_SECONDS: _refreshTtl,
      AUTH_REFRESH_COOKIE_NAME: _cookieName,
      ...rest
    } = validEnv;

    const config = loadAuthConfig(rest);

    expect(config.jwt.issuer).toBe("pos-cloud");
    expect(config.jwt.audience).toBe("pos-cloud-admin");
    expect(config.accessTokenTtlSeconds).toBe(900);
    expect(config.refreshTokenTtlSeconds).toBe(604800);
    expect(config.refreshCookieName).toBe("pos_cloud_admin_refresh");
    expect(config.secureCookies).toBe(false);
  });
});
