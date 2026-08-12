import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type { AdminUser } from "../../domain/admin-user";
import type { AdminUserId } from "../../domain/admin-user-id";
import type { AdminUserRepository } from "../../domain/admin-user-repository.port";
import { AdminEmailAlreadyExistsError } from "../../domain/admin-user.errors";
import type { Email } from "../../domain/email";
import { AdminUserMapper } from "./admin-user.mapper";
import { AdminUserRecord } from "./admin-user.record";

const UNIQUE_VIOLATION = "23505";

@Injectable()
export class TypeOrmAdminUserRepository implements AdminUserRepository {
  constructor(
    @InjectRepository(AdminUserRecord)
    private readonly repository: Repository<AdminUserRecord>,
  ) {}

  async findById(id: AdminUserId): Promise<AdminUser | null> {
    const record = await this.repository.findOne({ where: { id: id.toString() } });
    return record ? AdminUserMapper.toDomain(record) : null;
  }

  async findByEmail(email: Email): Promise<AdminUser | null> {
    const record = await this.repository.findOne({ where: { email: email.toString() } });
    return record ? AdminUserMapper.toDomain(record) : null;
  }

  async save(user: AdminUser): Promise<void> {
    try {
      await this.repository.save(AdminUserMapper.toRecord(user));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AdminEmailAlreadyExistsError();
      }
      throw error;
    }
  }

  async existsAny(): Promise<boolean> {
    const count = await this.repository.count();
    return count > 0;
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
