import { ConfigValidationError } from "./config-validation.error";
import { loadConfig } from "./load-config";

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  APP_NAME: "pos-cloud-api",
  APP_PORT: "5100",
  DATABASE_HOST: "localhost",
  DATABASE_PORT: "5433",
  DATABASE_NAME: "pos_cloud",
  DATABASE_USER: "pos_cloud",
  DATABASE_PASSWORD: "super-secret",
  REDIS_HOST: "localhost",
  REDIS_PORT: "6380",
  LOG_LEVEL: "info",
};

describe("loadConfig", () => {
  it("accepts a fully valid environment and returns a typed AppConfig", () => {
    const config = loadConfig(validEnv);

    expect(config).toEqual({
      env: "test",
      app: { name: "pos-cloud-api", port: 5100 },
      database: {
        host: "localhost",
        port: 5433,
        name: "pos_cloud",
        user: "pos_cloud",
        password: "super-secret",
      },
      redis: { host: "localhost", port: 6380 },
      logging: { level: "info" },
    });
  });

  it("fails fast when a required variable is missing", () => {
    const { DATABASE_PASSWORD: _omit, ...withoutPassword } = validEnv;

    expect(() => loadConfig(withoutPassword)).toThrow(ConfigValidationError);
  });

  it("does not leak the missing/invalid value in the error message", () => {
    const invalidEnv = { ...validEnv, DATABASE_PASSWORD: "" };

    expect.assertions(2);
    let caught: unknown;
    try {
      loadConfig(invalidEnv);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConfigValidationError);
    expect((caught as Error).message).not.toContain("super-secret");
  });

  it("rejects an out-of-range port", () => {
    const invalidEnv = { ...validEnv, APP_PORT: "70000" };

    expect(() => loadConfig(invalidEnv)).toThrow(ConfigValidationError);
  });

  it("rejects a non-numeric port", () => {
    const invalidEnv = { ...validEnv, APP_PORT: "not-a-port" };

    expect(() => loadConfig(invalidEnv)).toThrow(ConfigValidationError);
  });

  it("applies safe defaults for optional variables", () => {
    const { NODE_ENV: _env, LOG_LEVEL: _level, ...rest } = validEnv;

    const config = loadConfig(rest);

    expect(config.env).toBe("development");
    expect(config.logging.level).toBe("info");
  });
});
