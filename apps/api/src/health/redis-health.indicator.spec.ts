import { HealthCheckError } from "@nestjs/terminus";
import * as database from "@pos-cloud/database";
import type { Redis } from "ioredis";
import { RedisHealthIndicator } from "./redis-health.indicator";

jest.mock("@pos-cloud/database", () => ({
  pingRedis: jest.fn(),
}));

describe("RedisHealthIndicator", () => {
  const client = {} as Redis;
  const pingRedisMock = database.pingRedis as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("reports up when Redis responds to PING", async () => {
    pingRedisMock.mockResolvedValueOnce(undefined);
    const indicator = new RedisHealthIndicator(client);

    const result = await indicator.isRedisHealthy("redis");

    expect(result).toEqual({ redis: { status: "up" } });
  });

  it("throws HealthCheckError with status down when Redis is unreachable", async () => {
    pingRedisMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const indicator = new RedisHealthIndicator(client);

    await expect(indicator.isRedisHealthy("redis")).rejects.toBeInstanceOf(HealthCheckError);
  });
});
