import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from "@pos-cloud/shared-kernel";
import { AdminUser } from "../../domain/admin-user";
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from "../../domain/admin-user-repository.port";
import { AdminBootstrapAlreadyCompletedError } from "../../domain/admin-user.errors";
import { Password } from "../../domain/password";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port";

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
 */
@Injectable()
export class BootstrapFirstAdminUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly users: AdminUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
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

    return { id: user.id.toString(), email: user.email.toString() };
  }
}
