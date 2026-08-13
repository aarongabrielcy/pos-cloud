import { Inject, Injectable } from "@nestjs/common";
import { AdminUserId } from "../../domain/admin-user-id";
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from "../../domain/admin-user-repository.port";
import type { AdminUserStatus } from "../../domain/admin-user-status";
import { AdminUserNotFoundError } from "../../domain/admin-user.errors";
import type { PermissionCode } from "../../domain/permission";
import {
  PERMISSION_RESOLVER,
  type PermissionResolverPort,
} from "../ports/permission-resolver.port";

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
  /** Effective permission codes (the union across every role assigned to this admin), sorted
   *  lexicographically for a deterministic response - never PostgreSQL's accidental row order. See
   *  AdminMeResponseDto and BACKEND-HARDENING-01's own report for why /auth/me is the one place this
   *  is exposed, instead of the frontend decoding roles/claims that don't exist. */
  readonly permissions: readonly PermissionCode[];
}

/** Backs GET /auth/me. Deliberately excludes passwordHash and any session data - see AdminMeResponseDto. */
@Injectable()
export class GetAdminProfileUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly users: AdminUserRepository,
    @Inject(PERMISSION_RESOLVER) private readonly permissionResolver: PermissionResolverPort,
  ) {}

  async execute(query: GetAdminProfileQuery): Promise<AdminProfile> {
    const user = await this.users.findById(AdminUserId.of(query.adminUserId));
    if (!user) {
      throw new AdminUserNotFoundError(query.adminUserId);
    }

    // Same authority AdminAuthorizationGuard already queries for every RBAC-protected request - no
    // JWT claim, no role-name hardcoding, no duplicated SQL. A SUSPENDED admin resolves to an empty
    // set (see PermissionResolverPort's own contract) - not an error, not a 403 here.
    const effectivePermissions = await this.permissionResolver.resolveEffectivePermissions(
      user.id.toString(),
    );

    return {
      id: user.id.toString(),
      email: user.email.toString(),
      displayName: user.displayName,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      permissions: [...effectivePermissions].sort(),
    };
  }
}
