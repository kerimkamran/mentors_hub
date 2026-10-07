/** Shared fixture for the vetting tests: an organisation with a programme, a PM, assessors and applicants. */
import { OWNER_URL, connect, ownerOrg } from "./helpers";
import { actorFor, createOrg, createPerson, createProgramme, type TestOrg, type TestPerson } from "./factory";
import type { Actor } from "../../src/lib/permissions";
import { withOrg } from "../../src/lib/db";
import type { AssignDeps } from "../../src/domain/vetting/commands";
import { assignAssessor, saveAssessmentScores, startApplication, submitApplication, submitAssessment, saveApplicationDraft } from "../../src/domain/vetting/commands";
import { allItems } from "../../src/domain/vetting/rubric";
import { getMyAssessment } from "../../src/domain/vetting/queries";

export interface World {
  org: TestOrg;
  programmeId: string;
  cohortId: string;
  pm: TestPerson;
  pmActor: Actor;
}

export async function makeWorld(type: "leadership" | "sparklab" | "open" = "leadership"): Promise<World> {
  const org = await createOrg("vet");
  const { programmeId, cohortId } = await createProgramme(org, type);
  const pm = await createPerson(org, { roles: [{ role: "pm", scopeType: "programme", scopeId: programmeId }] });
  const { actor } = await actorFor(org, pm);
  return { org, programmeId, cohortId, pm, pmActor: actor };
}

export async function makeAssessor(w: World, name?: string): Promise<{ person: TestPerson; actor: Actor }> {
  const person = await createPerson(w.org, { name, roles: [{ role: "assessor", scopeType: "programme", scopeId: w.programmeId }] });
  const { actor } = await actorFor(w.org, person);
  return { person, actor };
}

export async function makeApplicant(w: World, name?: string): Promise<{ person: TestPerson; actor: Actor }> {
  const person = await createPerson(w.org, { name });
  const { actor } = await actorFor(w.org, person);
  return { person, actor };
}

export const GOOD_FORM = {
  motivation: "I want to help colleagues grow into confident leaders.",
  experience: "Twelve years leading engineering and delivery teams.",
  commitmentConfirmed: true,
};

/** An applicant with a submitted application. */
export async function submittedApplication(w: World, name?: string) {
  const a = await makeApplicant(w, name);
  const s = await startApplication(a.actor, w.programmeId);
  if (!s.ok) throw new Error("start failed");
  await saveApplicationDraft(a.actor, s.id, GOOD_FORM);
  const r = await submitApplication(a.actor, s.id);
  if (!r.ok) throw new Error("submit failed");
  return { ...a, applicationId: s.id };
}

export const noEdges: AssignDeps = { managerEdges: async () => () => null, now: () => new Date() };
export const edges = (m: Record<string, string>): AssignDeps => ({ managerEdges: async () => (id) => m[id] ?? null, now: () => new Date() });

/** Fill every item of an assessment with `value` (or a function of the item index) and optionally submit. */
export async function scoreAll(actor: Actor, assessmentId: string, value: number | ((i: number) => number), submit = true) {
  const view = await getMyAssessment(actor, assessmentId);
  const scores: Record<string, number> = {};
  allItems(view.rubric).forEach((it, i) => { scores[it.code] = typeof value === "number" ? value : value(i); });
  const saved = await saveAssessmentScores(actor, assessmentId, scores);
  if (!saved.ok) throw new Error("save failed");
  if (submit) {
    const r = await submitAssessment(actor, assessmentId);
    if (!r.ok) throw new Error("submit failed");
  }
}

export async function assign(w: World, applicationId: string, assessor: TestPerson, deps = noEdges) {
  const r = await assignAssessor(w.pmActor, applicationId, assessor.membershipId, {}, deps);
  if (!r.ok) throw new Error(`assign failed: ${r.reason}`);
  return r.assessmentId;
}

export async function auditActions(org: TestOrg): Promise<string[]> {
  return ownerOrg(org.id, async (c) => (await c.query("SELECT action FROM audit_log ORDER BY id")).rows.map((x) => x.action));
}

export async function ownerSql<T = Record<string, unknown>>(org: TestOrg, sql: string, params: unknown[] = []): Promise<T[]> {
  return ownerOrg(org.id, async (c) => (await c.query(sql, params)).rows as T[]);
}

export { withOrg, connect, OWNER_URL };

import { recordDecision, releaseDecision } from "../../src/domain/vetting/commands";

/** A fully approved (and optionally released) mentor: submitted application, one assessor scoring `value` on every item, approved. */
export async function approvedMentor(w: World, o: { release?: boolean; value?: number; name?: string } = {}) {
  const app = await submittedApplication(w, o.name);
  const assessor = await makeAssessor(w);
  const assessmentId = await assign(w, app.applicationId, assessor.person);
  await scoreAll(assessor.actor, assessmentId, o.value ?? 4);
  const d = await recordDecision(w.pmActor, app.applicationId, { decision: "approved" });
  if (!d.ok) throw new Error(`decision failed: ${d.reason}`);
  if (o.release) await releaseDecision(w.pmActor, app.applicationId, "Welcome aboard.");
  return { ...app, assessor, assessmentId };
}
