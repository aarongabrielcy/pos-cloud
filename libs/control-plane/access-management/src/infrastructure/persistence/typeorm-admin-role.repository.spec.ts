import type { Repository } from "typeorm";
import type { AdminUserRoleRecord } from "./admin-user-role.record";
import { TypeOrmAdminRoleRepository } from "./typeorm-admin-role.repository";

function buildRepository() {
  const execute = jest.fn().mockResolvedValue(undefined);
  const orIgnore = jest.fn().mockReturnValue({ execute });
  const values = jest.fn().mockReturnValue({ orIgnore });
  const into = jest.fn().mockReturnValue({ values });
  const insert = jest.fn().mockReturnValue({ into });
  const createQueryBuilder = jest.fn().mockReturnValue({ insert });

  const typeOrmRepository = { createQueryBuilder } as unknown as Repository<AdminUserRoleRecord>;
  const adminRoleRepository = new TypeOrmAdminRoleRepository(typeOrmRepository);

  return { adminRoleRepository, createQueryBuilder, insert, into, values, orIgnore, execute };
}

describe("TypeOrmAdminRoleRepository", () => {
  it("builds an INSERT ... ON CONFLICT DO NOTHING via orIgnore() - never a try/catch around a unique-violation exception", async () => {
    const { adminRoleRepository, values, orIgnore, execute } = buildRepository();
    const assignedAt = new Date("2026-01-01T00:00:00.000Z");

    await adminRoleRepository.assignRole("admin-1", "PLATFORM_ADMIN", assignedAt);

    expect(values).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      roleCode: "PLATFORM_ADMIN",
      assignedAt,
    });
    expect(orIgnore).toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
  });
});
