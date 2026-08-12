import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock } from "@pos-cloud/shared-kernel";
import type { AdminRoleCode } from "../../domain/admin-role";
import {
  ADMIN_ROLE_REPOSITORY,
  type AdminRoleRepository,
} from "../ports/admin-role-repository.port";

export interface AssignRoleToAdminCommand {
  readonly adminUserId: string;
  readonly roleCode: AdminRoleCode;
}

/**
 * The only mutator of `admin_user_roles` in CLOUD-01C-B. Its sole consumer today is
 * BootstrapFirstAdminUseCase (grants PLATFORM_ADMIN to the first admin) - no HTTP endpoint exposes
 * this yet, on purpose (see docs/architecture/admin-rbac.md#administration-scope): there is no flow
 * to create a *second* AdminUser yet, so a general "assign role" endpoint would have no real user
 * today. Kept as its own use case (not inlined into bootstrap) so a future admin-management task can
 * reuse it without duplicating the idempotency contract.
 */
@Injectable()
export class AssignRoleToAdminUseCase {
  constructor(
    @Inject(ADMIN_ROLE_REPOSITORY) private readonly adminRoles: AdminRoleRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: AssignRoleToAdminCommand): Promise<void> {
    await this.adminRoles.assignRole(command.adminUserId, command.roleCode, this.clock.now());
  }
}
