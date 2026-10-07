import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { authorize, can, NotFoundError, PERMISSION_SOURCES, PERMISSIONS, type Actor, type Grant } from "../../src/lib/permissions";

const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";
const mk = (roles: Grant[] = [], extra: Partial<Actor> = {}): Actor => ({
  identityId: "i", membershipId: "m1", organisationId: "o", roles, isPlatformAdmin: false,
  locale: "en", timeZone: "Asia/Baku", totpEnrolled: true, totpVerified: true, totpVerifiedAt: new Date(), ...extra,
});
const oa: Grant = { role: "org_admin", scopeType: "org", scopeId: null };
const pm = (id: string): Grant => ({ role: "pm", scopeType: "programme", scopeId: id });

describe("T-INV4-04 · permission matrix cells (core rows)", () => {
  it("deny by default: unknown action, no roles", () => {
    expect(can(mk([oa]), "does.not.exist")).toBe(false);
    expect(can(mk(), "audit.view")).toBe(false);
  });
  it("organisation settings and sign-off are org-admin only; PM and platform admin are denied", () => {
    expect(can(mk([oa]), "org.settings.change")).toBe(true);
    expect(can(mk([pm(P1)]), "org.settings.change", { programmeId: P1 })).toBe(false);
    expect(can(mk([], { isPlatformAdmin: true }), "org.settings.change")).toBe(false);
    expect(can(mk([], { isPlatformAdmin: true }), "org.read")).toBe(true);
  });
  it("roles are scoped: a PM grants assessors only inside their own programme", () => {
    expect(can(mk([pm(P1)]), "role.grant.assessor", { programmeId: P1 })).toBe(true);
    expect(can(mk([pm(P1)]), "role.grant.assessor", { programmeId: P2 })).toBe(false);
    expect(can(mk([pm(P1)]), "role.grant.pm", { programmeId: P1 })).toBe(false);
    expect(can(mk([pm(P1)]), "role.grant.org_admin")).toBe(false);
  });
  it("a cohort-scoped grant covers only that cohort, a programme grant covers its cohorts when the caller supplies both ids", () => {
    const cohortPm: Grant = { role: "pm", scopeType: "cohort", scopeId: "c1" };
    expect(can(mk([cohortPm]), "audit.view", { cohortId: "c1" })).toBe(true);
    expect(can(mk([cohortPm]), "audit.view", { cohortId: "c2" })).toBe(false);
    expect(can(mk([pm(P1)]), "audit.view", { programmeId: P1, cohortId: "c9" })).toBe(true);
  });
  it("list actions use 'anyscope' (caller filters); a person without the role still gets nothing", () => {
    expect(can(mk([pm(P1)]), "role.list")).toBe(true);
    expect(can(mk(), "role.list")).toBe(false);
  });
  it("audit export is org-admin only (PM may view but not export)", () => {
    expect(can(mk([pm(P1)]), "audit.view", { programmeId: P1 })).toBe(true);
    expect(can(mk([pm(P1)]), "audit.export", { programmeId: P1 })).toBe(false);
    expect(can(mk([oa]), "audit.export")).toBe(true);
  });
  it("'own' actions need the record to belong to the actor", () => {
    expect(can(mk(), "profile.edit.own", { ownerMembershipId: "m1" })).toBe(true);
    expect(can(mk(), "profile.edit.own", { ownerMembershipId: "someone-else" })).toBe(false);
    expect(can(mk(), "profile.edit.own")).toBe(false);
  });
  it("authorize throws the same NotFoundError for every denial, including a gate that throws (INV-8.5)", () => {
    expect(() => authorize(mk(), "audit.view")).toThrow(NotFoundError);
    expect(() => authorize(mk(), "nope")).toThrow(NotFoundError);
    const broken = { ...mk(), roles: null } as unknown as Actor;
    expect(() => authorize(broken, "audit.view")).toThrow(NotFoundError);
  });
});

describe("permission map hygiene", () => {
  it("no action id is defined in two sources", () => {
    const seen = new Set<string>();
    for (const src of PERMISSION_SOURCES) for (const k of Object.keys(src)) {
      expect(seen.has(k), `duplicate action ${k}`).toBe(false);
      seen.add(k);
    }
  });
  const files = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : []; });
  it("every action id used in authorize()/can() calls exists in the map", () => {
    const used = new Set<string>();
    for (const f of files("src").filter((x) => !x.includes("permissions"))) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/\b(?:authorize|can)\(\s*\w+\s*,\s*["'`]([a-z_.${}A-Z]+)["'`]/g)) used.add(m[1]!);
    }
    for (const a of used.values()) {
      if (a.includes("${")) continue; // dynamic ids such as role.grant.${role} are covered by the role tests
      expect(PERMISSIONS[a], `action ${a} is not in the permission map`).toBeDefined();
    }
  });
});
