import type { AdminUser } from "../domain/admin-user";
import type { AdminUserId } from "../domain/admin-user-id";
import type { AdminUserRepository } from "../domain/admin-user-repository.port";
import type { Email } from "../domain/email";

/** Test double for AdminUserRepository - never used in production code. */
export class InMemoryAdminUserRepository implements AdminUserRepository {
  private readonly byId = new Map<string, AdminUser>();

  async findById(id: AdminUserId): Promise<AdminUser | null> {
    return this.byId.get(id.toString()) ?? null;
  }

  async findByEmail(email: Email): Promise<AdminUser | null> {
    for (const user of this.byId.values()) {
      if (user.email.equals(email)) {
        return user;
      }
    }
    return null;
  }

  async save(user: AdminUser): Promise<void> {
    this.byId.set(user.id.toString(), user);
  }

  async existsAny(): Promise<boolean> {
    return this.byId.size > 0;
  }
}
