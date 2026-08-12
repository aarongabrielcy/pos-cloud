import type { Clock } from "@pos-cloud/shared-kernel";
import { CustomerCode } from "./customer-code";
import { CustomerId } from "./customer-id";
import { CustomerName } from "./customer-name";
import { CustomerStatus, isCustomerStatusTransitionAllowed } from "./customer-status";
import { InvalidCustomerStatusTransitionError } from "./customer.errors";

export interface CustomerProps {
  id: CustomerId;
  code: CustomerCode;
  legalName: CustomerName;
  tradeName: CustomerName | null;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerInput {
  id: string;
  code: string;
  legalName: string;
  tradeName?: string | null;
}

export class Customer {
  private constructor(private props: CustomerProps) {}

  static create(input: CreateCustomerInput, clock: Clock): Customer {
    const now = clock.now();

    return new Customer({
      id: CustomerId.of(input.id),
      code: CustomerCode.create(input.code),
      legalName: CustomerName.createLegalName(input.legalName),
      tradeName:
        input.tradeName != null && input.tradeName !== ""
          ? CustomerName.createTradeName(input.tradeName)
          : null,
      status: CustomerStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rehydrates a Customer from already-validated persisted state - no re-validation. */
  static reconstitute(props: CustomerProps): Customer {
    return new Customer(props);
  }

  changeStatus(next: CustomerStatus, clock: Clock): void {
    if (!isCustomerStatusTransitionAllowed(this.props.status, next)) {
      throw new InvalidCustomerStatusTransitionError(this.props.status, next);
    }
    this.props.status = next;
    this.props.updatedAt = clock.now();
  }

  get id(): CustomerId {
    return this.props.id;
  }

  get code(): CustomerCode {
    return this.props.code;
  }

  get legalName(): CustomerName {
    return this.props.legalName;
  }

  get tradeName(): CustomerName | null {
    return this.props.tradeName;
  }

  get status(): CustomerStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
