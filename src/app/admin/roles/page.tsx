import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Button, Heading } from "@/components/ui";
import { listRoles } from "@/domain/roles";
import { requireActor } from "@/lib/auth/http";
import { withOrg } from "@/lib/db";
import { NotFoundError } from "@/lib/permissions";
import { grant, revoke } from "./actions";

export const dynamic = "force-dynamic";

export default async function Roles() {
  const actor = await requireActor();
  let rows;
  try {
    rows = await listRoles(actor);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const people = await withOrg(actor.organisationId, (tx) =>
    tx.query<{ membership_id: string; display_name: string }>(
      "SELECT m.id AS membership_id, p.display_name FROM membership m JOIN person_profile p ON p.membership_id = m.id WHERE m.status = 'active' ORDER BY p.display_name",
    ),
  );
  return (
    <Shell wide>
      <Heading>Roles</Heading>
      <table className="mt-4 w-full text-left">
        <thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Scope</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-neutral-300 dark:border-neutral-700">
              <td className="py-2">{r.displayName}</td><td>{r.role}</td><td>{r.scopeType}</td>
              <td>
                <form action={revoke}><input type="hidden" name="id" value={r.id} /><Button type="submit" variant="secondary">Revoke</Button></form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form action={grant} className="mt-8 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1"><label htmlFor="m" className="font-medium">Person</label>
          <select id="m" name="membership_id" className="min-h-11 rounded-md border border-neutral-400 bg-transparent px-2">
            {people.rows.map((p) => <option key={p.membership_id} value={p.membership_id}>{p.display_name}</option>)}
          </select></div>
        <div className="flex flex-col gap-1"><label htmlFor="r" className="font-medium">Role</label>
          <select id="r" name="role" className="min-h-11 rounded-md border border-neutral-400 bg-transparent px-2">
            {["org_admin", "pm", "assessor", "content_manager", "safeguarding"].map((x) => <option key={x}>{x}</option>)}
          </select></div>
        <input type="hidden" name="scope_type" value="org" />
        <Button type="submit">Grant</Button>
      </form>
    </Shell>
  );
}
