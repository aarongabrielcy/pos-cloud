import { randomUUID } from "node:crypto";
import { FixedClock } from "../test-support/fixed-clock";
import { AdminUser, LOCK_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS } from "./admin-user";
import { AdminUserStatus } from "./admin-user-status";
import { InvalidAdminDisplayNameError } from "./admin-user.errors";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

function createAdminUser() {
  return AdminUser.create(
    {
      id: randomUUID(),
      email: "Admin@Example.com",
      displayName: "  Root Admin  ",
      passwordHash: "argon2id$fake-hash",
    },
    clock,
  );
}

describe("AdminUser", () => {
  it("starts ACTIVE with zeroed failure state", () => {
    const user = createAdminUser();
    expect(user.status).toBe(AdminUserStatus.ACTIVE);
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.lastLoginAt).toBeNull();
  });

  it("normalizes email (trim + lowercase) and displayName (trim)", () => {
    const user = createAdminUser();
    expect(user.email.toString()).toBe("admin@example.com");
    expect(user.displayName).toBe("Root Admin");
  });

  it("rejects an empty display name", () => {
    expect(() =>
      AdminUser.create(
        { id: randomUUID(), email: "a@b.com", displayName: "   ", passwordHash: "h" },
        clock,
      ),
    ).toThrow(InvalidAdminDisplayNameError);
  });

  describe("failed login / lockout", () => {
    it("increments failedLoginAttempts on each failure", () => {
      const user = createAdminUser();
      user.recordFailedLogin(clock);
      expect(user.failedLoginAttempts).toBe(1);
      expect(user.isLocked(clock.now())).toBe(false);
    });

    it(`locks the account for 15 minutes after ${MAX_FAILED_LOGIN_ATTEMPTS} consecutive failures`, () => {
      const user = createAdminUser();
      for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i += 1) {
        user.recordFailedLogin(clock);
      }
      expect(user.failedLoginAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS);
      expect(user.isLocked(clock.now())).toBe(true);
      expect(user.lockedUntil).toEqual(new Date(clock.now().getTime() + LOCK_DURATION_MS));
      expect(user.canAttemptLogin(clock.now())).toBe(false);
    });

    it("unlocks once lockedUntil is in the past", () => {
      const user = createAdminUser();
      for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i += 1) {
        user.recordFailedLogin(clock);
      }
      const afterLockExpires = new Date(clock.now().getTime() + LOCK_DURATION_MS + 1000);
      expect(user.isLocked(afterLockExpires)).toBe(false);
      expect(user.canAttemptLogin(afterLockExpires)).toBe(true);
    });

    it("a successful login resets failedLoginAttempts, lockedUntil, and stamps lastLoginAt", () => {
      const user = createAdminUser();
      for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i += 1) {
        user.recordFailedLogin(clock);
      }
      user.recordSuccessfulLogin(clock);
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
      expect(user.lastLoginAt).toEqual(clock.now());
    });
  });

  describe("canAttemptLogin", () => {
    it("is false for a SUSPENDED user even with no failed attempts", () => {
      const user = AdminUser.reconstitute({
        id: createAdminUser().id,
        email: createAdminUser().email,
        displayName: "Suspended Admin",
        passwordHash: "h",
        status: AdminUserStatus.SUSPENDED,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });

      expect(user.canAttemptLogin(clock.now())).toBe(false);
    });
  });
});
