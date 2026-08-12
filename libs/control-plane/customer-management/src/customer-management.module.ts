import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CLOCK, ID_GENERATOR, RandomUuidGenerator, SystemClock } from "@pos-cloud/shared-kernel";
import { ChangeCustomerStatusUseCase } from "./application/use-cases/change-customer-status.use-case";
import { CreateCustomerUseCase } from "./application/use-cases/create-customer.use-case";
import { GetCustomerByIdUseCase } from "./application/use-cases/get-customer-by-id.use-case";
import { ListCustomersUseCase } from "./application/use-cases/list-customers.use-case";
import { CUSTOMER_REPOSITORY } from "./domain/customer-repository.port";
import { CustomerRecord } from "./infrastructure/persistence/customer.record";
import { TypeOrmCustomerRepository } from "./infrastructure/persistence/typeorm-customer.repository";
import { CustomerController } from "./presentation/http/customer.controller";

/**
 * Public NestJS module for the Customer Management bounded context. Exports GetCustomerByIdUseCase
 * only - the minimum needed by the composition root to build a CustomerReaderPort adapter for
 * other bounded contexts (see apps/api's cross-context wiring). No repository, no record, no
 * mapper is exported: those stay internal to this package.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CustomerRecord])],
  controllers: [CustomerController],
  providers: [
    { provide: CUSTOMER_REPOSITORY, useClass: TypeOrmCustomerRepository },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: RandomUuidGenerator },
    CreateCustomerUseCase,
    GetCustomerByIdUseCase,
    ListCustomersUseCase,
    ChangeCustomerStatusUseCase,
  ],
  exports: [GetCustomerByIdUseCase],
})
export class CustomerManagementModule {}
