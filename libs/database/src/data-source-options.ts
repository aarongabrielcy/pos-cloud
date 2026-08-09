import type { AppConfig } from "@pos-cloud/config";
import type { DataSourceOptions } from "typeorm";

export interface DataSourceOptionsOverrides {
  logging?: boolean;
  entities?: NonNullable<DataSourceOptions["entities"]>;
  migrations?: NonNullable<DataSourceOptions["migrations"]>;
}

/**
 * Builds the single, reusable TypeORM DataSource configuration shared by the API process, the
 * worker process, and the migration CLI. `synchronize` and `migrationsRun` are permanently
 * disabled here - schema changes only ever happen through an explicit, user-run migration.
 */
export function buildDataSourceOptions(
  database: AppConfig["database"],
  overrides: DataSourceOptionsOverrides = {},
): DataSourceOptions {
  return {
    type: "postgres",
    host: database.host,
    port: database.port,
    username: database.user,
    password: database.password,
    database: database.name,
    synchronize: false,
    migrationsRun: false,
    logging: overrides.logging ?? false,
    entities: overrides.entities ?? [],
    migrations: overrides.migrations ?? [`${__dirname}/migrations/*{.ts,.js}`],
  };
}
