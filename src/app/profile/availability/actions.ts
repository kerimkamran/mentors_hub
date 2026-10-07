"use server";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/http";
import { addAvailability, addException, removeAvailability, removeException, type RuleKind } from "@/domain/availability/commands";
import { setMentorCapacity } from "@/domain/availability/capacity";
import { zonedToUtc, parseYmd, addDays } from "@/domain/availability/tz";
import { ValidationError } from "@/domain/profiles/errors";
import { failTo } from "../../_form";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const PATH = "/profile/availability";
const kindOf = (f: FormData): RuleKind => (str(f, "kind") === "window" ? "window" : "rule");

export async function addRuleAction(formData: FormData) {
  const actor = await requireActor();
  try {
    await addAvailability(actor, kindOf(formData), {
      weekday: Number(str(formData, "weekday")), start: str(formData, "start"), end: str(formData, "end"),
      timeZone: str(formData, "time_zone"), validFrom: str(formData, "valid_from") || null, validTo: str(formData, "valid_to") || null,
    });
  } catch (e) {
    failTo(PATH, e);
  }
  redirect(`${PATH}?saved=1`);
}

export async function removeRuleAction(formData: FormData) {
  const actor = await requireActor();
  try {
    await removeAvailability(actor, kindOf(formData), str(formData, "id"));
  } catch (e) {
    failTo(PATH, e);
  }
  redirect(PATH);
}

export async function addAwayAction(formData: FormData) {
  const actor = await requireActor();
  try {
    // Dates are the person's calendar days in THEIR time zone: from the start of the first day to the end of the last (included).
    const from = parseYmdOrFail(str(formData, "from"));
    const to = parseYmdOrFail(str(formData, "to"));
    const startsAt = zonedToUtc(from.year, from.month, from.day, 0, actor.timeZone);
    const next = addDays(to, 1);
    const endsAt = zonedToUtc(next.year, next.month, next.day, 0, actor.timeZone);
    await addException(actor, { startsAt, endsAt });
  } catch (e) {
    failTo(PATH, e);
  }
  redirect(`${PATH}?saved=1`);
}

function parseYmdOrFail(s: string) {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error();
    return parseYmd(s);
  } catch {
    throw new ValidationError("availability.validity");
  }
}

export async function removeAwayAction(formData: FormData) {
  const actor = await requireActor();
  try {
    await removeException(actor, str(formData, "id"));
  } catch (e) {
    failTo(PATH, e);
  }
  redirect(PATH);
}

export async function setCapacityAction(formData: FormData) {
  const actor = await requireActor();
  let belowLoad = false;
  try {
    const raw = str(formData, "capacity");
    if (!/^\d{1,3}$/.test(raw)) throw new ValidationError("capacity.invalid");
    belowLoad = (await setMentorCapacity(actor, { participationId: str(formData, "participation_id"), capacity: Number(raw) })).belowLoad;
  } catch (e) {
    failTo(PATH, e);
  }
  redirect(`${PATH}?cap=${belowLoad ? "below" : "ok"}`);
}
