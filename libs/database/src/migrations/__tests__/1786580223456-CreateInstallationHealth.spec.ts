import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSource = readFileSync(
  join(__dirname, "../1786580223456-CreateInstallationHealth.ts"),
  "utf8",
);

describe("CreateInstallationHealth (migration #7) source", () => {
  it("creates installation_health in the existing installations schema (no new schema)", () => {
    expect(migrationSource).toContain("CREATE TABLE installations.installation_health");
    expect(migrationSource).not.toContain("CREATE SCHEMA");
  });

  it("declares every expected column, installation_id as the primary key", () => {
    expect(migrationSource).toContain("installation_id     uuid PRIMARY KEY");
    for (const column of ["first_seen_at", "last_seen_at", "client_reported_at", "app_version"]) {
      expect(migrationSource).toContain(column);
    }
  });

  it("has an FK to installations.installations with ON DELETE CASCADE", () => {
    expect(migrationSource).toContain(
      "FOREIGN KEY (installation_id) REFERENCES installations.installations (id) ON DELETE CASCADE",
    );
  });

  it("has no status/updated_at/history columns - health is computed at read time, never persisted", () => {
    // Scoped to the actual SQL query string (backtick-delimited), not the surrounding explanatory
    // comment - which legitimately mentions "status"/"updated_at" as prose explaining their absence.
    const [createTableQuery] = [...migrationSource.matchAll(/`([^`]*)`/g)].map((match) => match[1]);
    expect(createTableQuery).not.toContain(" status ");
    expect(createTableQuery).not.toContain("updated_at");
  });

  it("down() drops only the table, never the shared installations schema", () => {
    const downBody = migrationSource.slice(migrationSource.indexOf("public async down"));
    expect(downBody).toContain("DROP TABLE IF EXISTS installations.installation_health");
    expect(downBody).not.toContain("DROP SCHEMA");
  });
});
