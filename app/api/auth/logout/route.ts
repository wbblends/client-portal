import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth";
import { logEvent } from "@/lib/audit";

export async function POST() {
  const session = await getSession();
  if (session) {
    logEvent({
      action: "auth.logout",
      actorId: session.id,
      actorUsername: session.username,
    });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
