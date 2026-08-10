import { Customer } from "../../domain/customer";
import { CustomerCode } from "../../domain/customer-code";
import { CustomerId } from "../../domain/customer-id";
import { CustomerName } from "../../domain/customer-name";
import type { CustomerStatus } from "../../domain/customer-status";
import { CustomerRecord } from "./customer.record";

export class CustomerMapper {
  static toDomain(record: CustomerRecord): Customer {
    return Customer.reconstitute({
      id: CustomerId.of(record.id),
      code: CustomerCode.reconstitute(record.code),
      legalName: CustomerName.reconstitute(record.legalName),
      tradeName: record.tradeName !== null ? CustomerName.reconstitute(record.tradeName) : null,
      status: record.status as CustomerStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toRecord(customer: Customer): CustomerRecord {
    const record = new CustomerRecord();
    record.id = customer.id.toString();
    record.code = customer.code.toString();
    record.legalName = customer.legalName.toString();
    record.tradeName = customer.tradeName?.toString() ?? null;
    record.status = customer.status;
    record.createdAt = customer.createdAt;
    record.updatedAt = customer.updatedAt;
    return record;
  }
}
