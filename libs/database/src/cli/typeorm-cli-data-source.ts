import "reflect-metadata";
import { loadConfig } from "@pos-cloud/config";
import { DataSource } from "typeorm";
import { buildDataSourceOptions } from "../data-source-options";

/**
 * Entry point for the TypeORM CLI (`typeorm-ts-node-commonjs`). Not used by the API or worker
 * processes at runtime - see libs/database/src/data-source.ts for that. This file exists so the
 * user can run `migration:generate` / `migration:run` / `migration:revert` once real migrations
 * exist. It is never invoked automatically.
 */
const config = loadConfig();

export default new DataSource(
  buildDataSourceOptions(config.database, {
    migrations: [`${__dirname}/../migrations/*{.ts,.js}`],
  }),
);
