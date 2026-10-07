import { NextResponse } from "next/server";
import { ping } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database reachability. Reveals no hostnames, versions or credentials (AC-ADM-08.2). */
export async function GET() {
  const db = await ping();
  return NextResponse.json(
    { status: db ? "ok" : "degraded", checks: { database: db ? "healthy" : "down" } },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
