import { notFoundResponse, fileResponse, routeActor } from "@/lib/http-guards";
import { isLocale } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { templateCsv, templateXlsx } from "@/domain/people/template";

export const dynamic = "force-dynamic";

/** The published import template (FR-IMP-002). Read-only; changes nothing. */
export async function GET(req: Request) {
  const actor = await routeActor(req);
  if (!actor || !can(actor, "import.list")) return notFoundResponse();
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang");
  const locale = isLocale(lang) ? lang : actor.locale;
  if (url.searchParams.get("format") === "xlsx")
    return fileResponse(await templateXlsx(locale), `people-import-template-${locale}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  return fileResponse(templateCsv(locale), `people-import-template-${locale}.csv`, "text/csv; charset=utf-8");
}
