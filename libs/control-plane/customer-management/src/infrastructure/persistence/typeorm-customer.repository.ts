import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { PaginatedResult } from "@pos-cloud/shared-kernel";
import { buildPaginatedResult } from "@pos-cloud/shared-kernel";
import { In, type Repository } from "typeorm";
import { Customer } from "../../domain/customer";
import type { CustomerCode } from "../../domain/customer-code";
import type { CustomerId } from "../../domain/customer-id";
import type {
  CustomerRepository,
  ListCustomersCriteria,
} from "../../domain/customer-repository.port";
import { CustomerCodeAlreadyExistsError } from "../../domain/customer.errors";
import { CustomerMapper } from "./customer.mapper";
import { CustomerRecord } from "./customer.record";

const UNIQUE_VIOLATION = "23505";

@Injectable()
export class TypeOrmCustomerRepository implements CustomerRepository {
  constructor(
    @InjectRepository(CustomerRecord) private readonly repository: Repository<CustomerRecord>,
  ) {}

  async findById(id: CustomerId): Promise<Customer | null> {
    const record = await this.repository.findOne({ where: { id: id.toString() } });
    return record ? CustomerMapper.toDomain(record) : null;
  }

  async findByCode(code: CustomerCode): Promise<Customer | null> {
    const record = await this.repository.findOne({ where: { code: code.toString() } });
    return record ? CustomerMapper.toDomain(record) : null;
  }

  async save(customer: Customer): Promise<void> {
    try {
      await this.repository.save(CustomerMapper.toRecord(customer));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new CustomerCodeAlreadyExistsError(customer.code.toString());
      }
      throw error;
    }
  }

  async findByIds(ids: readonly string[]): Promise<Customer[]> {
    if (ids.length === 0) {
      return [];
    }
    const records = await this.repository.find({ where: { id: In([...ids]) } });
    return records.map(CustomerMapper.toDomain);
  }

  async list(criteria: ListCustomersCriteria): Promise<PaginatedResult<Customer>> {
    const qb = this.repository.createQueryBuilder("customer");

    if (criteria.status) {
      qb.andWhere("customer.status = :status", { status: criteria.status });
    }

    if (criteria.search) {
      qb.andWhere(
        "(customer.code ILIKE :search OR customer.legal_name ILIKE :search OR customer.trade_name ILIKE :search)",
        { search: `%${criteria.search}%` },
      );
    }

    qb.orderBy("customer.created_at", "DESC")
      .skip((criteria.page - 1) * criteria.pageSize)
      .take(criteria.pageSize);

    const [records, total] = await qb.getManyAndCount();

    return buildPaginatedResult(records.map(CustomerMapper.toDomain), total, criteria);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
