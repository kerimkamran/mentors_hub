/**
 * Pure visibility rules (permission matrix §5, FR-PRF-001, FR-PRF-010, INV-7.2).
 * No database access: callers pass facts computed from the database, never from the request.
 */
import {
  DEFAULT_LEVEL, ENGINE_FIELDS, VISIBILITY_FIELDS, VISIBILITY_LEVELS,
  type EngineField, type VisibilityField, type VisibilityLevel,
} from "./constants";

export const isLevel = (x: unknown): x is VisibilityLevel => typeof x === "string" && (VISIBILITY_LEVELS as readonly string[]).includes(x);
export const isVisibilityField = (x: unknown): x is VisibilityField => typeof x === "string" && (VISIBILITY_FIELDS as readonly string[]).includes(x);

/** Name is the one field that may never be "Only me": counterparts and the PM need it to function (decision, see report). */
export const LOWEST_LEVEL: Partial<Record<VisibilityField, VisibilityLevel>> = { name: "request_or_match" };

export function levelAllowed(field: VisibilityField, level: VisibilityLevel): boolean {
  return !(field === "name" && level === "only_me");
}

export type LevelMap = Record<VisibilityField, VisibilityLevel>;

/** Stored overrides on top of the defaults. A missing row means the default (new profile: Only me, except name and department). */
export function effectiveLevels(stored: Partial<Record<string, string>>): LevelMap {
  const out = { ...DEFAULT_LEVEL } as LevelMap;
  for (const f of VISIBILITY_FIELDS) {
    const v = stored[f];
    if (isLevel(v) && levelAllowed(f, v)) out[f] = v;
  }
  return out;
}

export interface ViewContext {
  isOwner: boolean;
  /** Viewer and owner are opposite sides (approved mentor <-> mentee/team member) of one programme. */
  counterpartInSharedProgramme: boolean;
  /** Viewer and owner are linked by a request, proposal or relationship. */
  hasRequestOrRelationship: boolean;
}

/** May this viewer read a field whose owner chose `level`? */
export function canView(level: VisibilityLevel, ctx: ViewContext): boolean {
  if (ctx.isOwner) return true;
  if (level === "only_me") return false;
  if (level === "programme_counterparts") return ctx.counterpartInSharedProgramme || ctx.hasRequestOrRelationship;
  return ctx.hasRequestOrRelationship; // request_or_match
}

/** Does the matching engine read a field that the owner set to this level? "Only me" is neither returned nor used. */
export const engineCanRead = (level: VisibilityLevel): boolean => level !== "only_me";

export function engineReadableFields(levels: LevelMap): EngineField[] {
  return ENGINE_FIELDS.filter((f) => engineCanRead(levels[f]));
}

export type Audience = "only_me" | "counterparts" | "matched";

/** Audience key for the "What matching can see" view; the UI turns it into words in the person's language and kind. */
export function audienceOf(level: VisibilityLevel): Audience {
  return level === "only_me" ? "only_me" : level === "programme_counterparts" ? "counterparts" : "matched";
}

export interface MatchingViewRow {
  field: EngineField | "goals" | "capacity";
  audience: Audience;
}
export interface MatchingView {
  /** Exactly what the engine reads for this person, and who can see each field. */
  readable: MatchingViewRow[];
  /** Fields the person has kept to themselves: not read by matching. */
  notUsed: (EngineField | "goals")[];
}

/**
 * "What matching can see" (AC-PRF-02.4). Lists only engine-readable data. It has no row for grade bucket or
 * reporting line, which are HR inputs, not profile fields, and are never displayed (matrix §5).
 */
export function describeMatchingView(levels: LevelMap, goalLevels: VisibilityLevel[], opts: { isMentor: boolean }): MatchingView {
  const readable: MatchingViewRow[] = [];
  const notUsed: MatchingView["notUsed"] = [];
  for (const f of ENGINE_FIELDS) {
    if (engineCanRead(levels[f])) readable.push({ field: f, audience: audienceOf(levels[f]) });
    else notUsed.push(f);
  }
  const shared = goalLevels.filter(engineCanRead);
  if (goalLevels.length > 0) {
    if (shared.length > 0) {
      // Several goals may differ: show the widest audience among those the engine reads.
      const widest = shared.includes("programme_counterparts") ? "programme_counterparts" : "request_or_match";
      readable.push({ field: "goals", audience: audienceOf(widest) });
    } else notUsed.push("goals");
  }
  if (opts.isMentor) readable.push({ field: "capacity", audience: "counterparts" });
  return { readable, notUsed };
}
