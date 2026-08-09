import { Test } from "@nestjs/testing";
import { HealthCheckError, TerminusModule } from "@nestjs/terminus";
import { DatabaseHealthIndicator } from "./database-health.indicator";
import { HealthController } from "./health.controller";
import { RedisHealthIndicator } from "./redis-health.indicator";

describe("HealthController", () => {
  it("live() returns healthy without consulting database or redis indicators", async () => {
    const database = { isDatabaseHealthy: jest.fn() };
    const redis = { isRedisHealthy: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        { provide: DatabaseHealthIndicator, useValue: database },
        { provide: RedisHealthIndicator, useValue: redis },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);

    const result = controller.live();

    expect(result).toEqual({ status: "ok" });
    expect(database.isDatabaseHealthy).not.toHaveBeenCalled();
    expect(redis.isRedisHealthy).not.toHaveBeenCalled();
  });

  it("ready() reports healthy when both dependencies are up", async () => {
    const database = {
      isDatabaseHealthy: jest.fn().mockResolvedValue({ database: { status: "up" } }),
    };
    const redis = {
      isRedisHealthy: jest.fn().mockResolvedValue({ redis: { status: "up" } }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        { provide: DatabaseHealthIndicator, useValue: database },
        { provide: RedisHealthIndicator, useValue: redis },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);

    const result = await controller.ready();

    expect(result.status).toBe("ok");
    expect(result.details).toMatchObject({
      database: { status: "up" },
      redis: { status: "up" },
    });
  });

  it("ready() reflects a down Redis dependency as an unhealthy check", async () => {
    const database = {
      isDatabaseHealthy: jest.fn().mockResolvedValue({ database: { status: "up" } }),
    };
    const redis = {
      isRedisHealthy: jest
        .fn()
        .mockRejectedValue(
          new HealthCheckError("Redis check failed", { redis: { status: "down" } }),
        ),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        { provide: DatabaseHealthIndicator, useValue: database },
        { provide: RedisHealthIndicator, useValue: redis },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);

    await expect(controller.ready()).rejects.toThrow();
  });
});
