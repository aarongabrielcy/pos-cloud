import { Global, Module } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";

/**
 * Stands in for the real DataSource so a bounded context's real NestJS module (with its real
 * `TypeOrmModule.forFeature(...)`) can boot in an HTTP contract test without a PostgreSQL
 * connection. `getRepository` is never actually called: every use case the module would otherwise
 * construct with a real TypeORM repository is itself overridden with a fake in the test - this
 * only exists to satisfy `forFeature`'s internal `@InjectRepository` wiring during module init.
 */
function createFakeDataSource(): DataSource {
  return {
    // @nestjs/typeorm's forFeature() factory reads these two before calling getRepository().
    entityMetadatas: [],
    options: { type: "postgres" },
    getRepository: () => ({}),
  } as unknown as DataSource;
}

@Global()
@Module({
  providers: [{ provide: getDataSourceToken(), useValue: createFakeDataSource() }],
  exports: [getDataSourceToken()],
})
export class FakeDatabaseModule {}
