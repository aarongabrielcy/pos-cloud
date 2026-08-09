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

  it("defaults logging to false", () => {
    const options = buildDataSourceOptions(database);

    expect(options.logging).toBe(false);
  });
});
