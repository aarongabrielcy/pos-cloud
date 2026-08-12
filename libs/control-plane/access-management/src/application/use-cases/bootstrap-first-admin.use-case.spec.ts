import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { Email } from "../../domain/email";
import {
  AdminBootstrapAlreadyCompletedError,
  InvalidAdminPasswordError,
} from "../../domain/admin-user.errors";
import { FakePasswordHasher } from "../../test-support/fake-password-hasher";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryAdminRoleRepository } from "../../test-support/in-memory-admin-role-repository";
import { InMemoryAdminUserRepository } from "../../test-support/in-memory-admin-user-repository";
import { AssignRoleToAdminUseCase } from "./assign-role-to-admin.use-case";
import { BootstrapFirstAdminUseCase } from "./bootstrap-first-admin.use-case";

function setup() {
  const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
  const users = new InMemoryAdminUserRepository();
  const hasher = new FakePasswordHasher();
  const idGenerator = new RandomUuidGenerator();
  const adminRoles = new InMemoryAdminRoleRepository();
  const assignRoleToAdmin = new AssignRoleToAdminUseCase(adminRoles, clock);
  const useCase = new BootstrapFirstAdminUseCase(
    users,
    hasher,
    clock,
    idGenerator,
    assignRoleToAdmin,
  );
  return { useCase, users, hasher, adminRoles };
}

describe("BootstrapFirstAdminUseCase", () => {
  it("creates the first admin user with a hashed password", async () => {
    const { useCase, users } = setup();

    const result = await useCase.execute({
      email: "root@example.com",
      password: "a-strong-enough-password",
      displayName: "Root Admin",
    });

    expect(result.email).toBe("root@example.com");
    const stored = await users.findByEmail(Email.create("root@example.com"));
    // FakePasswordHasher deliberately embeds the plaintext (reversibly, for its own verify() to
    // work) - unlike the real Argon2PasswordHasher, which never does (see that adapter's own spec).
    // This only proves the use case went through the hasher at all, not that hashing is one-way.
    expect(stored?.passwordHash).not.toBe("a-strong-enough-password");
    expect(stored?.passwordHash).toBe("fake-hash:a-strong-enough-password");
  });

  it("rejects a password shorter than the policy minimum", async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ email: "root@example.com", password: "short", displayName: "Root Admin" }),
    ).rejects.toThrow(InvalidAdminPasswordError);
  });

  it("rejects a second bootstrap once any AdminUser already exists", async () => {
    const { useCase } = setup();

    await useCase.execute({
      email: "root@example.com",
      password: "a-strong-enough-password",
      displayName: "Root Admin",
    });

    await expect(
      useCase.execute({
        email: "second@example.com",
        password: "another-strong-password",
        displayName: "Second Admin",
      }),
    ).rejects.toThrow(AdminBootstrapAlreadyCompletedError);
  });

  it("assigns PLATFORM_ADMIN to the admin it just created (CLOUD-01C-B) - it never authenticates without also being able to do anything", async () => {
    const { useCase, users, adminRoles } = setup();

    const result = await useCase.execute({
      email: "root@example.com",
      password: "a-strong-enough-password",
      displayName: "Root Admin",
    });

    const stored = await users.findByEmail(Email.create("root@example.com"));
    expect(stored?.id.toString()).toBe(result.id);
    expect(adminRoles.roleCodesFor(result.id)).toEqual(["PLATFORM_ADMIN"]);
  });

  it("a retried role assignment against an already-bootstrapped admin does not duplicate the assignment (repairs the crash-between-save-and-assign window described in this use case's own comment)", async () => {
    const { useCase, adminRoles } = setup();

    const result = await useCase.execute({
      email: "root@example.com",
      password: "a-strong-enough-password",
      displayName: "Root Admin",
    });

    // Simulates the repair path: re-running the idempotent assignment by hand for an admin that
    // already has the role, exactly as the migration's own backfill INSERT would on re-run.
    const assignRoleToAdmin = new AssignRoleToAdminUseCase(
      adminRoles,
      new FixedClock(new Date("2026-01-02T00:00:00.000Z")),
    );
    await assignRoleToAdmin.execute({ adminUserId: result.id, roleCode: "PLATFORM_ADMIN" });

    expect(adminRoles.roleCodesFor(result.id)).toEqual(["PLATFORM_ADMIN"]);
    expect(adminRoles.size()).toBe(1);
  });
});
