import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSource = readFileSync(
  join(__dirname, "../1786580123456-CreateAuditCore.ts"),
  "utf8",
);

describe("CreateAuditCore (migration #6) source", () => {
  it("creates the audit schema and audit_events table", () => {
    expect(migrationSource).toContain("CREATE SCHEMA audit");
    expect(migrationSource).toContain("CREATE TABLE audit.audit_events");
  });

  it("declares every expected column", () => {
    for (const column of [
      "id",
      "occurred_at",
      "actor_type",
      "actor_id",
      "action",
      "resource_type",
      "resource_id",
      "correlation_id",
      "metadata",
    ]) {
      expect(migrationSource).toContain(column);
    }
  });

  it("constrains actor_type to the three known values", () => {
    expect(migrationSource).toContain("CHECK (actor_type IN ('ADMIN', 'INSTALLATION', 'SYSTEM'))");
  });

  it("creates all four expected indexes", () => {
    expect(migrationSource).toContain("ix_audit_events_occurred_at");
    expect(migrationSource).toContain("ix_audit_events_resource");
    expect(migrationSource).toContain("ix_audit_events_actor");
    expect(migrationSource).toContain("ix_audit_events_action");
  });

  it("has no FK to any other schema (audit is a cross-cutting write sink, ADR-007)", () => {
    expect(migrationSource).not.toContain("FOREIGN KEY");
  });

  it("down() drops the table then the schema, no CASCADE", () => {
    const downBody = migrationSource.slice(migrationSource.indexOf("public async down"));
    // Scoped to the actual SQL query strings (backtick-delimited), not the surrounding explanatory
    // comment - which legitimately contains the prose "No CASCADE" as an explanation.
    const queries = [...downBody.matchAll(/`([^`]*)`/g)].map((match) => match[1]);
    expect(queries).toContain("DROP TABLE IF EXISTS audit.audit_events");
    expect(queries).toContain("DROP SCHEMA audit");
    for (const query of queries) {
      expect(query).not.toContain("CASCADE");
    }
  });
});
