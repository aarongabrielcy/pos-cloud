import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type { AdminRoleCode } from "../../domain/admin-role";
import type { AdminRoleRepository } from "../../application/ports/admin-role-repository.port";
import { AdminUserRoleRecord } from "./admin-user-role.record";

@Injectable()
export class TypeOrmAdminRoleRepository implements AdminRoleRepository {
  constructor(
    @InjectRepository(AdminUserRoleRecord)
    private readonly repository: Repository<AdminUserRoleRecord>,
  ) {}

  async assignRole(adminUserId: string, roleCode: AdminRoleCode, assignedAt: Date): Promise<void> {
    // ON CONFLICT DO NOTHING, not a try/catch around a unique-violation - a caught unique violation
    // still leaves the surrounding PostgreSQL transaction aborted (see AdminRoleRepository's own
    // comment); this is a genuine no-op at the database level.
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(AdminUserRoleRecord)
      .values({ adminUserId, roleCode, assignedAt })
      .orIgnore()
      .execute();
  }
}
