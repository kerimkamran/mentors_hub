"use client";
import { useEffect, useRef, useState } from "react";
import { autosaveProfileText } from "./actions";

type Status = "idle" | "saving" | "saved" | "failed";

/**
 * The free-text part of the profile with autosave (FR-PRF-009, X6): after a pause in typing the text is stored as a draft on
 * the server, with a polite "Saving… / Saved / Not saved — retrying" status; a failed save retries by itself and when the
 * connection returns. Without JavaScript the form still works through the Save button.
 */
export function AutosaveText(props: {
  action: (fd: FormData) => void | Promise<void>;
  initial: { bio: string; headline: string };
  labels: { headline: string; headlineHint: string; bio: string; save: string; saving: string; saved: string; failed: string };
  maxBio: number;
  maxHeadline: number;
  children?: React.ReactNode;
}) {
  const [bio, setBio] = useState(props.initial.bio);
  const [headline, setHeadline] = useState(props.initial.headline);
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ bio, headline });
  const dirty = useRef(false);

  async function run() {
    setStatus("saving");
    try {
      const r = await autosaveProfileText(latest.current);
      if (r.ok) {
        dirty.current = false;
        setStatus("saved");
      } else {
        setStatus("failed");
        if (r.retry) timer.current = setTimeout(run, 4000);
      }
    } catch {
      setStatus("failed");
      timer.current = setTimeout(run, 4000);
    }
  }

  function changed(next: { bio: string; headline: string }) {
    latest.current = next;
    dirty.current = true;
    clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(run, 800);
  }

  useEffect(() => {
    const online = () => dirty.current && run();
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registered once; run reads refs
  }, []);

  const text = status === "saving" ? props.labels.saving : status === "saved" ? props.labels.saved : status === "failed" ? props.labels.failed : "";
  return (
    <form action={props.action} className="mt-3 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="headline" className="font-medium">{props.labels.headline}</label>
        <input id="headline" name="headline" maxLength={props.maxHeadline} value={headline} aria-describedby="headline-hint"
          onChange={(e) => { setHeadline(e.target.value); changed({ bio, headline: e.target.value }); }}
          className="min-h-11 rounded-md border border-neutral-400 bg-transparent px-3 py-2" />
        <p id="headline-hint" className="text-sm opacity-80">{props.labels.headlineHint}</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="bio" className="font-medium">{props.labels.bio}</label>
        <textarea id="bio" name="bio" rows={6} maxLength={props.maxBio} value={bio}
          onChange={(e) => { setBio(e.target.value); changed({ bio: e.target.value, headline }); }}
          className="rounded-md border border-neutral-400 bg-transparent px-3 py-2" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="min-h-11 min-w-11 rounded-md bg-neutral-900 px-4 py-2 font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">{props.labels.save}</button>
        <p role="status" aria-live="polite" className="text-sm">{text ? (status === "failed" ? "! " : status === "saved" ? "✓ " : "") + text : ""}</p>
      </div>
      {props.children}
    </form>
  );
}
