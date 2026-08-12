import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { Email } from "../../domain/email";
import {
  AdminBootstrapAlreadyCompletedError,
  InvalidAdminPasswordError,
} from "../../domain/admin-user.errors";
import { FakePasswordHasher } from "../../test-support/fake-password-hasher";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryAdminUserRepository } from "../../test-support/in-memory-admin-user-repository";
import { BootstrapFirstAdminUseCase } from "./bootstrap-first-admin.use-case";

function setup() {
  const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
  const users = new InMemoryAdminUserRepository();
  const hasher = new FakePasswordHasher();
  const idGenerator = new RandomUuidGenerator();
  const useCase = new BootstrapFirstAdminUseCase(users, hasher, clock, idGenerator);
  return { useCase, users, hasher };
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
});
