import "reflect-metadata";
import { loadConfig } from "@pos-cloud/config";
import { buildDataSourceOptions } from "@pos-cloud/database";
import { DataSource } from "typeorm";
import { controlPlaneEntities } from "./entities";

/**
 * Entry point for `pnpm migration:generate` only - `migration:show`/`run`/`revert`/`create` keep
 * using @pos-cloud/database's own CLI datasource (libs/database/src/cli/typeorm-cli-data-source.ts),
 * which needs no entity metadata. `migration:generate` is the one command that must compare real
 * entity metadata against PostgreSQL, hence this separate composition root - see ./entities.ts and
 * ../../README.md. `migrations` is left at buildDataSourceOptions' default: it resolves relative to
 * @pos-cloud/database's own module location (libs/database/src/migrations), not this package's -
 * so migrations still land in the one canonical place regardless of which package's CLI invoked
 * this file.
 */
const config = loadConfig();

export default new DataSource(
  buildDataSourceOptions(config.database, {
    logging: config.env === "development",
    entities: controlPlaneEntities,
  }),
);
