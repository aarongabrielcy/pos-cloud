import { HealthCheckError } from "@nestjs/terminus";
import * as database from "@pos-cloud/database";
import type { DataSource } from "typeorm";
import { DatabaseHealthIndicator } from "./database-health.indicator";

jest.mock("@pos-cloud/database", () => ({
  pingDataSource: jest.fn(),
}));

describe("DatabaseHealthIndicator", () => {
  const dataSource = {} as DataSource;
  const pingDataSourceMock = database.pingDataSource as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("reports up when the database responds", async () => {
    pingDataSourceMock.mockResolvedValueOnce(undefined);
    const indicator = new DatabaseHealthIndicator(dataSource);

    const result = await indicator.isDatabaseHealthy("database");

    expect(result).toEqual({ database: { status: "up" } });
  });

  it("throws HealthCheckError with status down when the database is unreachable", async () => {
    pingDataSourceMock.mockRejectedValueOnce(new Error("connection refused"));
    const indicator = new DatabaseHealthIndicator(dataSource);

    await expect(indicator.isDatabaseHealthy("database")).rejects.toBeInstanceOf(HealthCheckError);
  });
});
