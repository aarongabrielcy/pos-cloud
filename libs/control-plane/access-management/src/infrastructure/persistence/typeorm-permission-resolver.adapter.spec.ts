import type { DataSource } from "typeorm";
import { TypeOrmPermissionResolverAdapter } from "./typeorm-permission-resolver.adapter";

function buildAdapter(rows: Array<{ permission_code: string }>) {
  const query = jest.fn().mockResolvedValue(rows);
  const dataSource = { query } as unknown as DataSource;
  const adapter = new TypeOrmPermissionResolverAdapter(dataSource);
  return { adapter, query };
}

describe("TypeOrmPermissionResolverAdapter", () => {
  it("resolves the permission codes the query returns as a Set", async () => {
    const { adapter, query } = buildAdapter([
      { permission_code: "customers.read" },
      { permission_code: "customers.create" },
    ]);

    const result = await adapter.resolveEffectivePermissions("admin-1");

    expect(result).toEqual(new Set(["customers.read", "customers.create"]));
    expect(query).toHaveBeenCalledWith(expect.stringContaining("au.status = 'ACTIVE'"), [
      "admin-1",
    ]);
  });

  it("returns an empty set when the query returns no rows (no roles, or SUSPENDED - both produce zero rows from the same WHERE clause)", async () => {
    const { adapter } = buildAdapter([]);

    const result = await adapter.resolveEffectivePermissions("admin-without-permissions");

    expect(result.size).toBe(0);
  });

  it("throws (fails loudly) on a permission code the catalog doesn't recognize, instead of silently granting or dropping it", async () => {
    const { adapter } = buildAdapter([{ permission_code: "customers.delete" }]);

    await expect(adapter.resolveEffectivePermissions("admin-1")).rejects.toThrow(
      /Unknown permission code/,
    );
  });

  it("deduplicates when the same permission is granted by two different roles (union semantics, not a count)", async () => {
    const { adapter } = buildAdapter([
      { permission_code: "customers.read" },
      { permission_code: "customers.read" },
    ]);

    const result = await adapter.resolveEffectivePermissions("admin-with-two-roles");

    expect(result.size).toBe(1);
  });
});
