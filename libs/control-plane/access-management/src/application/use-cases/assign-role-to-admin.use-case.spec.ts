import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryAdminRoleRepository } from "../../test-support/in-memory-admin-role-repository";
import { AssignRoleToAdminUseCase } from "./assign-role-to-admin.use-case";

function setup() {
  const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
  const adminRoles = new InMemoryAdminRoleRepository();
  const useCase = new AssignRoleToAdminUseCase(adminRoles, clock);
  return { useCase, adminRoles };
}

describe("AssignRoleToAdminUseCase", () => {
  it("assigns the role to the admin", async () => {
    const { useCase, adminRoles } = setup();

    await useCase.execute({ adminUserId: "admin-1", roleCode: "PLATFORM_ADMIN" });

    expect(adminRoles.roleCodesFor("admin-1")).toEqual(["PLATFORM_ADMIN"]);
  });

  it("is idempotent: assigning the same role twice produces exactly one assignment, never an exception", async () => {
    const { useCase, adminRoles } = setup();

    await useCase.execute({ adminUserId: "admin-1", roleCode: "PLATFORM_ADMIN" });
    await expect(
      useCase.execute({ adminUserId: "admin-1", roleCode: "PLATFORM_ADMIN" }),
    ).resolves.toBeUndefined();

    expect(adminRoles.roleCodesFor("admin-1")).toEqual(["PLATFORM_ADMIN"]);
    expect(adminRoles.size()).toBe(1);
  });

  it("supports multiple distinct roles for the same admin - effective permissions are their union (resolved separately, see TypeOrmPermissionResolverAdapter)", async () => {
    const { useCase, adminRoles } = setup();

    await useCase.execute({ adminUserId: "admin-1", roleCode: "PLATFORM_VIEWER" });
    await useCase.execute({ adminUserId: "admin-1", roleCode: "PLATFORM_OPERATOR" });

    expect(new Set(adminRoles.roleCodesFor("admin-1"))).toEqual(
      new Set(["PLATFORM_VIEWER", "PLATFORM_OPERATOR"]),
    );
  });
});
