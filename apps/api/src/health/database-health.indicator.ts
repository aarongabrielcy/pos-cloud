import { Injectable } from "@nestjs/common";
import { HealthCheckError, type HealthIndicatorResult } from "@nestjs/terminus";
import { InjectDataSource } from "@nestjs/typeorm";
import { pingDataSource } from "@pos-cloud/database";
import type { DataSource } from "typeorm";

@Injectable()
export class DatabaseHealthIndicator {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async isDatabaseHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await pingDataSource(this.dataSource);
      return { [key]: { status: "up" } };
    } catch (error) {
      throw new HealthCheckError("Database check failed", {
        [key]: { status: "down", message: (error as Error).message },
      });
    }
  }
}
