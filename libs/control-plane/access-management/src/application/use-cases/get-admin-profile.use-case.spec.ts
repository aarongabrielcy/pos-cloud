import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { AdminUser } from "../../domain/admin-user";
import { AdminUserNotFoundError } from "../../domain/admin-user.errors";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryAdminUserRepository } from "../../test-support/in-memory-admin-user-repository";
import { GetAdminProfileUseCase } from "./get-admin-profile.use-case";

describe("GetAdminProfileUseCase", () => {
  it("returns only public fields - never passwordHash", async () => {
    const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
    const users = new InMemoryAdminUserRepository();
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

    const useCase = new GetAdminProfileUseCase(users);
    const profile = await useCase.execute({ adminUserId: user.id.toString() });

    expect(profile).toEqual({
      id: user.id.toString(),
      email: "admin@example.com",
      displayName: "Root Admin",
      status: "ACTIVE",
      createdAt: clock.now(),
      lastLoginAt: null,
    });
    expect(JSON.stringify(profile)).not.toContain("super-secret-hash");
  });

  it("throws AdminUserNotFoundError when the id does not exist", async () => {
    const users = new InMemoryAdminUserRepository();
    const useCase = new GetAdminProfileUseCase(users);

    await expect(
      useCase.execute({ adminUserId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toThrow(AdminUserNotFoundError);
  });
});
