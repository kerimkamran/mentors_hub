import { describe, expect, it } from "vitest";
import { lintMigrationSql } from "../../scripts/lint-migrations";

const base = `
CREATE TABLE note (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES organisation (id),
  body text
);
ALTER TABLE note ENABLE ROW LEVEL SECURITY;
ALTER TABLE note FORCE ROW LEVEL SECURITY;`;

describe("migration lint (INV-1.1 / 1.2 / 1.6, T-INV8-04)", () => {
  it("accepts a correct tenant table", () => {
    expect(lintMigrationSql(base)).toEqual([]);
  });
  it("rejects a tenant table without organisation_id", () => {
    expect(lintMigrationSql(base.replace(/organisation_id uuid NOT NULL REFERENCES organisation \(id\),/, ""))).toEqual(
      expect.arrayContaining([expect.stringContaining("INV-1.1")]),
    );
  });
  it("rejects a table without forced RLS", () => {
    expect(lintMigrationSql(base.replace("ALTER TABLE note FORCE ROW LEVEL SECURITY;", ""))).toEqual(
      expect.arrayContaining([expect.stringContaining("FORCE")]),
    );
  });
  it("rejects an unlisted global table", () => {
    expect(lintMigrationSql("CREATE TABLE secrets (\n  id int\n);")).not.toEqual([]);
  });
  it("rejects password columns", () => {
    expect(lintMigrationSql("CREATE TABLE organisation (\n  id uuid,\n  password text\n);")).toEqual(
      expect.arrayContaining([expect.stringContaining("INV-8.4")]),
    );
  });
});
