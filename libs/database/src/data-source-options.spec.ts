import { buildDataSourceOptions } from "./data-source-options";

const database = {
  host: "localhost",
  port: 5433,
  name: "pos_cloud",
  user: "pos_cloud",
  password: "super-secret",
};

describe("buildDataSourceOptions", () => {
  it("always disables synchronize and migrationsRun", () => {
    const options = buildDataSourceOptions(database);

    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
  });

  it("cannot be overridden to enable synchronize or migrationsRun", () => {
    const options = buildDataSourceOptions(database, {
      // @ts-expect-error - overrides intentionally do not expose synchronize/migrationsRun
      synchronize: true,
    });

    expect(options.synchronize).toBe(false);
  });

  it("maps AppConfig database fields onto DataSourceOptions", () => {
    const options = buildDataSourceOptions(database);

    expect(options).toMatchObject({
      type: "postgres",
      host: "localhost",
      port: 5433,
      username: "pos_cloud",
      password: "super-secret",
      database: "pos_cloud",
    });
  });

  it("always disables logging", () => {
    const options = buildDataSourceOptions(database);

    expect(options.logging).toBe(false);
  });

  it("cannot be overridden to enable logging", () => {
    // Regression guard: a prior `logging: config.env === "development"` pattern at several call
    // sites (apps/api, apps/worker, both CLI datasources) caused TypeORM's default logger to print
    // full bound query parameters - including an Argon2id password_hash - during a real
    // `admin:bootstrap` run. `logging` is intentionally not part of DataSourceOptionsOverrides
    // anymore, so this cast is the only way left to attempt it, proving the factory ignores it.
    const options = buildDataSourceOptions(database, {
      logging: true,
    } as unknown as Parameters<typeof buildDataSourceOptions>[1]);

    expect(options.logging).toBe(false);
  });
});
