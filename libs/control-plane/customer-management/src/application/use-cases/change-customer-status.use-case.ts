import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock } from "@pos-cloud/shared-kernel";
import { CustomerId } from "../../domain/customer-id";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from "../../domain/customer-repository.port";
import type { CustomerStatus } from "../../domain/customer-status";
import { Customer } from "../../domain/customer";
import { CustomerNotFoundError } from "../../domain/customer.errors";

export interface ChangeCustomerStatusCommand {
  readonly id: string;
  readonly status: CustomerStatus;
}

@Injectable()
export class ChangeCustomerStatusUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: ChangeCustomerStatusCommand): Promise<Customer> {
    const customer = await this.customers.findById(CustomerId.of(command.id));
    if (!customer) {
      throw new CustomerNotFoundError(command.id);
    }

    customer.changeStatus(command.status, this.clock);
    await this.customers.save(customer);

    return customer;
  }
}
