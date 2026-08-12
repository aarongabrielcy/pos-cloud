import { ConflictError, NotFoundError, ValidationError } from "@pos-cloud/shared-kernel";

export class InvalidCustomerCodeError extends ValidationError {
  constructor(value: string) {
    super(
      "INVALID_CUSTOMER_CODE",
      `Invalid customer code: "${value}". Expected 3-50 chars matching ^[A-Z0-9][A-Z0-9_-]{2,49}$ (after trim/uppercase).`,
    );
  }
}

export class InvalidCustomerLegalNameError extends ValidationError {
  constructor() {
    super("INVALID_CUSTOMER_LEGAL_NAME", "Customer legalName must be 2-200 characters after trim.");
  }
}

export class InvalidCustomerTradeNameError extends ValidationError {
  constructor() {
    super("INVALID_CUSTOMER_TRADE_NAME", "Customer tradeName must be 1-200 characters after trim.");
  }
}

export class InvalidCustomerStatusTransitionError extends ValidationError {
  constructor(from: string, to: string) {
    super(
      "INVALID_CUSTOMER_STATUS_TRANSITION",
      `Cannot transition Customer status from ${from} to ${to}.`,
    );
  }
}

export class CustomerNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("CUSTOMER_NOT_FOUND", `Customer not found: ${id}`);
  }
}

export class CustomerCodeAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super("CUSTOMER_CODE_ALREADY_EXISTS", `Customer code already exists: ${code}`);
  }
}
