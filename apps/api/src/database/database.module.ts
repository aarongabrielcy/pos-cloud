import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import type { AppConfig } from "@pos-cloud/config";
import { buildDataSourceOptions } from "@pos-cloud/database";
import { APP_CONFIG } from "../config/app-config.tokens";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        ...buildDataSourceOptions(config.database),
        // Every bounded context registers its own persistence records via its own
        // TypeOrmModule.forFeature([...]) call inside its own module - this module never imports
        // any bounded context's Record classes directly (they are deliberately not part of any
        // package's public API). autoLoadEntities collects them all into this one DataSource
        // without DatabaseModule needing to know which bounded contexts exist.
        autoLoadEntities: true,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
