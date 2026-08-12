import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import type { AppConfig } from "@pos-cloud/config";
import { buildDataSourceOptions } from "@pos-cloud/database";
import { APP_CONFIG } from "../config/app-config.tokens";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => buildDataSourceOptions(config.database),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
