import { Inject, Injectable } from "@nestjs/common";
import { CustomerId } from "../../domain/customer-id";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from "../../domain/customer-repository.port";
import type { Customer } from "../../domain/customer";

@Injectable()
export class GetCustomerByIdUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository) {}

  /** Returns null when not found - "not found" is a normal query outcome, not an exceptional one. */
  async execute(id: string): Promise<Customer | null> {
    return this.customers.findById(CustomerId.of(id));
  }
}
