import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from "@pos-cloud/shared-kernel";
import { CustomerCode } from "../../domain/customer-code";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from "../../domain/customer-repository.port";
import { Customer } from "../../domain/customer";
import { CustomerCodeAlreadyExistsError } from "../../domain/customer.errors";

export interface CreateCustomerCommand {
  readonly code: string;
  readonly legalName: string;
  readonly tradeName?: string | null;
}

@Injectable()
export class CreateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async execute(command: CreateCustomerCommand): Promise<Customer> {
    const code = CustomerCode.create(command.code);

    // Known race: a concurrent request could pass this check for the same code before either
    // save() completes. The `customers.code` UNIQUE constraint in PostgreSQL is the real guard;
    // the repository adapter translates that constraint violation into this same error.
    const existing = await this.customers.findByCode(code);
    if (existing) {
      throw new CustomerCodeAlreadyExistsError(code.toString());
    }

    const customer = Customer.create(
      {
        id: this.idGenerator.next(),
        code: command.code,
        legalName: command.legalName,
        tradeName: command.tradeName,
      },
      this.clock,
    );

    await this.customers.save(customer);

    return customer;
  }
}
