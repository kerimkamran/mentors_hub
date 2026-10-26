"use client";
import { useActionState } from "react";
import { Alert, Button, Card, Field } from "@/components/ui";
import { invite, type InviteState } from "./actions";

export interface InviteLabels {
  title: string; intro: string; name: string; email: string; password: string; passwordHint: string; submit: string;
  passwordSetTitle: string;
  linkTitle: string; linkHint: string; linkLabel: string;
}

/** Shows the single-use link right after it is created; it cannot be shown again (only a hash is stored). */
export function InviteForm({ labels }: { labels: InviteLabels }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(invite, {});
  return (
    <Card className="mt-4 max-w-3xl">
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      <p className="mt-1">{labels.intro}</p>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <Field label={labels.name} name="name" maxLength={200} autoComplete="off" />
        <Field label={labels.email} name="email" type="email" inputMode="email" autoComplete="off" />
        <Field label={labels.password} name="password" type="text" required={false} maxLength={128} autoComplete="off" hint={labels.passwordHint} />
        <div><Button type="submit" disabled={pending}>{labels.submit}</Button></div>
      </form>
      {state.error && <div className="mt-3"><Alert kind="error">{state.error}</Alert></div>}
      {state.link && (
        <div className="mt-3">
          <Alert kind="success">
            {state.passwordSet && <p className="font-medium">{labels.passwordSetTitle} {state.email}</p>}
            <p className="font-medium">{labels.linkTitle} {state.email}</p>
            <p className="mt-1">{labels.linkHint}</p>
            <label htmlFor="invite-link" className="mt-2 block font-medium">{labels.linkLabel}</label>
            <input id="invite-link" readOnly value={state.link} onFocus={(e) => e.currentTarget.select()}
              className="mt-1 min-h-11 w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 font-mono text-sm" />
          </Alert>
        </div>
      )}
    </Card>
  );
}
