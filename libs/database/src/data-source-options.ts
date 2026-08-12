import type { AppConfig } from "@pos-cloud/config";
import type { DataSourceOptions } from "typeorm";

export interface DataSourceOptionsOverrides {
  entities?: NonNullable<DataSourceOptions["entities"]>;
  migrations?: NonNullable<DataSourceOptions["migrations"]>;
}

/**
 * Builds the single, reusable TypeORM DataSource configuration shared by the API process, the
 * worker process, and the migration CLI. `synchronize` and `migrationsRun` are permanently
 * disabled here - schema changes only ever happen through an explicit, user-run migration.
 *
 * `logging` is permanently `false` and is not exposed as an override: TypeORM's default query
 * logger prints full bound parameters (including password/refresh-token hashes) for both
 * successful and failed queries, and there is no per-column redaction hook to filter that output.
 * A prior `logging: config.env === "development"` pattern at several call sites relied on this and
 * leaked an Argon2id hash to stdout during a real `admin:bootstrap` run - see
 * data-source-options.spec.ts. Structured application logging (request/response, errors) continues
 * to go through Pino (@pos-cloud/observability), which is never handed raw query parameters.
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
    logging: false,
    entities: overrides.entities ?? [],
    migrations: overrides.migrations ?? [`${__dirname}/migrations/*{.ts,.js}`],
  };
}
