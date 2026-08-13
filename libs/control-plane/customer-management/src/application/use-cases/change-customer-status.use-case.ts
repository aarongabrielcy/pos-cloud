import { Inject, Injectable } from "@nestjs/common";
import {
  AUDIT_RECORDER_PORT,
  type AuditActorContext,
  type AuditRecorderPort,
  CLOCK,
  type Clock,
} from "@pos-cloud/shared-kernel";
import { CUSTOMER_AUDIT_ACTIONS, CUSTOMER_AUDIT_RESOURCE_TYPE } from "../audit-actions";
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
    @Inject(AUDIT_RECORDER_PORT) private readonly auditRecorder: AuditRecorderPort,
  ) {}

  async execute(command: ChangeCustomerStatusCommand, actor: AuditActorContext): Promise<Customer> {
    const customer = await this.customers.findById(CustomerId.of(command.id));
    if (!customer) {
      throw new CustomerNotFoundError(command.id);
    }

    const from = customer.status;
    customer.changeStatus(command.status, this.clock);
    await this.customers.save(customer);

    await this.auditRecorder.record({
      actor,
      action: CUSTOMER_AUDIT_ACTIONS.STATUS_CHANGED,
      resourceType: CUSTOMER_AUDIT_RESOURCE_TYPE,
      resourceId: customer.id.toString(),
      metadata: { from, to: customer.status },
    });

    return customer;
  }
}
