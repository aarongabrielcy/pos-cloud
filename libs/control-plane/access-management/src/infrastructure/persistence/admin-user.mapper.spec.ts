import { randomUUID } from "node:crypto";
import { AdminUser } from "../../domain/admin-user";
import { FixedClock } from "../../test-support/fixed-clock";
import { AdminUserMapper } from "./admin-user.mapper";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("AdminUserMapper", () => {
  it("round-trips an AdminUser through toRecord/toDomain", () => {
    const original = AdminUser.create(
      {
        id: randomUUID(),
        email: "Admin@Example.com",
        displayName: "Root Admin",
        passwordHash: "argon2id$fake-hash",
      },
      clock,
    );

    const rehydrated = AdminUserMapper.toDomain(AdminUserMapper.toRecord(original));

    expect(rehydrated.id.equals(original.id)).toBe(true);
    expect(rehydrated.email.equals(original.email)).toBe(true);
    expect(rehydrated.displayName).toBe("Root Admin");
    expect(rehydrated.passwordHash).toBe("argon2id$fake-hash");
    expect(rehydrated.status).toBe(original.status);
    expect(rehydrated.lockedUntil).toBeNull();
  });

  it("preserves lockedUntil/failedLoginAttempts after a failed login", () => {
    const original = AdminUser.create(
      { id: randomUUID(), email: "a@b.com", displayName: "Admin", passwordHash: "h" },
      clock,
    );
    original.recordFailedLogin(clock);

    const rehydrated = AdminUserMapper.toDomain(AdminUserMapper.toRecord(original));

    expect(rehydrated.failedLoginAttempts).toBe(1);
  });
});
