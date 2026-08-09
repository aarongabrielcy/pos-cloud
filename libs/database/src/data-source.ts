import "reflect-metadata";
import type { AppConfig } from "@pos-cloud/config";
import { DataSource } from "typeorm";
import { buildDataSourceOptions, type DataSourceOptionsOverrides } from "./data-source-options";

export function createDataSource(
  database: AppConfig["database"],
  overrides?: DataSourceOptionsOverrides,
): DataSource {
  return new DataSource(buildDataSourceOptions(database, overrides));
}

/** Runs `SELECT 1` to verify connectivity. Throws if the database is unreachable. */
export async function pingDataSource(dataSource: DataSource): Promise<void> {
  await dataSource.query("SELECT 1");
}
