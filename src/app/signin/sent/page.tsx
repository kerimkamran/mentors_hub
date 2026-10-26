import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Emailed links and codes are no longer used for sign-in; keep old bookmarks working. */
export default function Sent() {
  redirect("/signin");
}
