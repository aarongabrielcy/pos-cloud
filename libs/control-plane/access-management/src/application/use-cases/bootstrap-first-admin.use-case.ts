import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from "@pos-cloud/shared-kernel";
import { ADMIN_ROLES } from "../../domain/admin-role";
import { AdminUser } from "../../domain/admin-user";
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from "../../domain/admin-user-repository.port";
import { AdminBootstrapAlreadyCompletedError } from "../../domain/admin-user.errors";
import { Password } from "../../domain/password";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port";
import { AssignRoleToAdminUseCase } from "./assign-role-to-admin.use-case";

export interface BootstrapFirstAdminCommand {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

export interface BootstrapFirstAdminResult {
  readonly id: string;
  readonly email: string;
}

/**
 * Only ever invoked by the `admin:bootstrap` CLI tool (apps/api/src/tooling/admin-bootstrap.main.ts)
 * - never exposed over HTTP (see docs/architecture/admin-authentication.md#bootstrap). Refuses to
 * run a second time: if any AdminUser already exists, this is not "create another admin", it is a
 * no-op that fails loudly instead of silently succeeding.
 *
 * CLOUD-01C-B: grants PLATFORM_ADMIN to the admin it just created, so bootstrap never leaves behind
 * an AdminUser that authenticates but can't do anything (see docs/architecture/
 * admin-rbac.md#bootstrap). Deliberately NOT wrapped in a single cross-repository database
 * transaction with the user save above it - that would need a new, bootstrap-only unit-of-work
 * abstraction for a one-shot CLI path that isn't a realistic concurrency target. Instead this relies
 * on `AssignRoleToAdminUseCase`/`AdminRoleRepository.assignRole` being idempotent (`ON CONFLICT DO
 * NOTHING`, see that port's own comment): if the process crashes between the two calls below, the
 * AdminUser row exists without a role, which the CreateAccessManagementRbac migration's own
 * "backfill PLATFORM_ADMIN for pre-existing admin_users" step already exists to repair (it is safe
 * to re-run that exact INSERT ... SELECT by hand at any time - it is a plain idempotent upsert).
 */
@Injectable()
export class BootstrapFirstAdminUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly users: AdminUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    private readonly assignRoleToAdmin: AssignRoleToAdminUseCase,
  ) {}

  async execute(command: BootstrapFirstAdminCommand): Promise<BootstrapFirstAdminResult> {
    if (await this.users.existsAny()) {
      throw new AdminBootstrapAlreadyCompletedError();
    }

    const password = Password.create(command.password);
    const passwordHash = await this.passwordHasher.hash(password.reveal());

    const user = AdminUser.create(
      {
        id: this.idGenerator.next(),
        email: command.email,
        displayName: command.displayName,
        passwordHash,
      },
      this.clock,
    );

    await this.users.save(user);
    await this.assignRoleToAdmin.execute({
      adminUserId: user.id.toString(),
      roleCode: ADMIN_ROLES.PLATFORM_ADMIN,
    });

    return { id: user.id.toString(), email: user.email.toString() };
  }
}
