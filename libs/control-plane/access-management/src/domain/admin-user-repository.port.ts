import type { AdminUser } from "./admin-user";
import type { AdminUserId } from "./admin-user-id";
import type { Email } from "./email";

export interface AdminUserRepository {
  findById(id: AdminUserId): Promise<AdminUser | null>;
  findByEmail(email: Email): Promise<AdminUser | null>;
  save(user: AdminUser): Promise<void>;
  /** Used solely by bootstrap to refuse creating a second admin - see BootstrapFirstAdminUseCase. */
  existsAny(): Promise<boolean>;
}

export const ADMIN_USER_REPOSITORY = Symbol("ADMIN_USER_REPOSITORY");
