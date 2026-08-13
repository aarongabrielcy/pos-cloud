import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { AdminUser } from "../../domain/admin-user";
import { AdminUserNotFoundError } from "../../domain/admin-user.errors";
import { PERMISSIONS } from "../../domain/permission";
import { FakePermissionResolver } from "../../test-support/fake-permission-resolver";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryAdminUserRepository } from "../../test-support/in-memory-admin-user-repository";
import { GetAdminProfileUseCase } from "./get-admin-profile.use-case";

describe("GetAdminProfileUseCase", () => {
  it("returns only public fields - never passwordHash - plus sorted effective permissions", async () => {
    const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
    const users = new InMemoryAdminUserRepository();
    const permissionResolver = new FakePermissionResolver();
    const idGenerator = new RandomUuidGenerator();
    const user = AdminUser.create(
      {
        id: idGenerator.next(),
        email: "admin@example.com",
        displayName: "Root Admin",
        passwordHash: "argon2id$super-secret-hash",
      },
      clock,
    );
    await users.save(user);
    // Granted out of alphabetical order on purpose - the use case must sort, not just pass through
    // whatever order the resolver/DB happens to return.
    permissionResolver.grant(
      user.id.toString(),
      PERMISSIONS.INSTALLATIONS.READ,
      PERMISSIONS.CUSTOMERS.READ,
      PERMISSIONS.AUDIT.READ,
    );

    const useCase = new GetAdminProfileUseCase(users, permissionResolver);
    const profile = await useCase.execute({ adminUserId: user.id.toString() });

    expect(profile).toEqual({
      id: user.id.toString(),
      email: "admin@example.com",
      displayName: "Root Admin",
      status: "ACTIVE",
      createdAt: clock.now(),
      lastLoginAt: null,
      permissions: [
        PERMISSIONS.AUDIT.READ,
        PERMISSIONS.CUSTOMERS.READ,
        PERMISSIONS.INSTALLATIONS.READ,
      ],
    });
    expect(JSON.stringify(profile)).not.toContain("super-secret-hash");
  });

  it("returns an empty permissions array when the resolver grants nothing (e.g. a SUSPENDED admin)", async () => {
    const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
    const users = new InMemoryAdminUserRepository();
    const permissionResolver = new FakePermissionResolver();
    const idGenerator = new RandomUuidGenerator();
    const user = AdminUser.create(
      {
        id: idGenerator.next(),
        email: "admin@example.com",
        displayName: "Root Admin",
        passwordHash: "argon2id$super-secret-hash",
      },
      clock,
    );
    await users.save(user);

    const useCase = new GetAdminProfileUseCase(users, permissionResolver);
    const profile = await useCase.execute({ adminUserId: user.id.toString() });

    expect(profile.permissions).toEqual([]);
  });

  it("throws AdminUserNotFoundError when the id does not exist", async () => {
    const users = new InMemoryAdminUserRepository();
    const permissionResolver = new FakePermissionResolver();
    const useCase = new GetAdminProfileUseCase(users, permissionResolver);

    await expect(
      useCase.execute({ adminUserId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toThrow(AdminUserNotFoundError);
  });
});
