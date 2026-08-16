// Public API of @pos-cloud/customer-management.
// Deliberately excluded: infrastructure/persistence (records, mapper, TypeORM repository) and
// presentation/http internals (controller, DTOs) - those are wiring details, not part of the
// contract other bounded contexts or the composition root should depend on directly.

export { CustomerManagementModule } from "./customer-management.module";

export { CreateCustomerUseCase } from "./application/use-cases/create-customer.use-case";
export type { CreateCustomerCommand } from "./application/use-cases/create-customer.use-case";
export { GetCustomerByIdUseCase } from "./application/use-cases/get-customer-by-id.use-case";
export { GetCustomersByIdsUseCase } from "./application/use-cases/get-customers-by-ids.use-case";
export { ListCustomersUseCase } from "./application/use-cases/list-customers.use-case";
export type { ListCustomersQuery } from "./application/use-cases/list-customers.use-case";
export { ChangeCustomerStatusUseCase } from "./application/use-cases/change-customer-status.use-case";
export type { ChangeCustomerStatusCommand } from "./application/use-cases/change-customer-status.use-case";

export type { Customer } from "./domain/customer";
export { CustomerStatus } from "./domain/customer-status";
export * from "./domain/customer.errors";
