import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression test for a real bug: the public `admin:bootstrap` wrapper relied solely on
 * docker-compose.yml's own bare `environment: - VARNAME` entries to forward
 * BOOTSTRAP_ADMIN_EMAIL/DISPLAY_NAME/PASSWORD from the host shell into the
 * `pos-cloud-admin-bootstrap` container - which proved unreliable in practice (a real run reported
 * the variable missing inside the container despite being set in the host shell). The fix is
 * explicit `-e VARNAME` flags on the `docker compose run` invocation itself (see infra/
 * docker-compose.yml's pos-cloud-admin-bootstrap comment for the full explanation) - this test
 * guards against that flag list silently regressing again (e.g. a future edit "simplifying" the
 * script back to the version that broke).
 */
describe("admin:bootstrap script", () => {
  const rootPackageJson = JSON.parse(
    readFileSync(join(__dirname, "../../../../package.json"), "utf8"),
  ) as { scripts: Record<string, string> };

  it("passes BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_DISPLAY_NAME, and BOOTSTRAP_ADMIN_PASSWORD through as -e flags", () => {
    const script = rootPackageJson.scripts["admin:bootstrap"];

    expect(script).toContain("-e BOOTSTRAP_ADMIN_EMAIL");
    expect(script).toContain("-e BOOTSTRAP_ADMIN_DISPLAY_NAME");
    expect(script).toContain("-e BOOTSTRAP_ADMIN_PASSWORD");
    expect(script).toContain("pos-cloud-admin-bootstrap");
  });

  it("never hardcodes a value alongside any BOOTSTRAP_ADMIN_* flag (each -e is a bare variable name)", () => {
    const script = rootPackageJson.scripts["admin:bootstrap"];

    expect(script).not.toMatch(/BOOTSTRAP_ADMIN_(EMAIL|DISPLAY_NAME|PASSWORD)=/);
  });

  it("admin:bootstrap:internal never shells out to Docker (avoids recursion)", () => {
    const script = rootPackageJson.scripts["admin:bootstrap:internal"];

    expect(script).not.toContain("docker");
  });
});
