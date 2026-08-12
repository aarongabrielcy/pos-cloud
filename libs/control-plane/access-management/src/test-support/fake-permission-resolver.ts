import type { PermissionResolverPort } from "../application/ports/permission-resolver.port";
import type { PermissionCode } from "../domain/permission";

/** Test double for PermissionResolverPort - never used in production code. */
export class FakePermissionResolver implements PermissionResolverPort {
  private readonly effectivePermissions = new Map<string, Set<PermissionCode>>();

  grant(adminUserId: string, ...codes: PermissionCode[]): void {
    const existing = this.effectivePermissions.get(adminUserId) ?? new Set<PermissionCode>();
    for (const code of codes) {
      existing.add(code);
    }
    this.effectivePermissions.set(adminUserId, existing);
  }

  async resolveEffectivePermissions(adminUserId: string): Promise<ReadonlySet<PermissionCode>> {
    return this.effectivePermissions.get(adminUserId) ?? new Set<PermissionCode>();
  }
}
