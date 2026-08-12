import { Inject, Injectable } from "@nestjs/common";
import { AdminUserId } from "../../domain/admin-user-id";
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from "../../domain/admin-user-repository.port";
import type { AdminUserStatus } from "../../domain/admin-user-status";
import { AdminUserNotFoundError } from "../../domain/admin-user.errors";

export interface GetAdminProfileQuery {
  readonly adminUserId: string;
}

export interface AdminProfile {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: AdminUserStatus;
  readonly createdAt: Date;
  readonly lastLoginAt: Date | null;
}

/** Backs GET /auth/me. Deliberately excludes passwordHash and any session data - see AdminMeResponseDto. */
@Injectable()
export class GetAdminProfileUseCase {
  constructor(@Inject(ADMIN_USER_REPOSITORY) private readonly users: AdminUserRepository) {}

  async execute(query: GetAdminProfileQuery): Promise<AdminProfile> {
    const user = await this.users.findById(AdminUserId.of(query.adminUserId));
    if (!user) {
      throw new AdminUserNotFoundError(query.adminUserId);
    }

    return {
      id: user.id.toString(),
      email: user.email.toString(),
      displayName: user.displayName,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
