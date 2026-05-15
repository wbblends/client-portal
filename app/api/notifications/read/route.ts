import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  markAllNotificationsRead,
  markNotificationsRead,
  unreadCountForUser,
} from "@/lib/notifications/store";

/** POST — mark notifications as read. Body shapes:
 *  - `{ ids: ["...", "..."] }` — mark a specific set (when the user clicks a row).
 *  - `{ all: true }`            — mark every unread one (the "Mark all read" button).
 *  Returns the fresh unread count so the badge can update without a second fetch. */
export async function POST(request: NextRequest) {
  const me = await requireSession();
  const body = (await request.json().catch(() => ({}))) as {
    ids?: unknown;
    all?: unknown;
  };

  if (body.all === true) {
    await markAllNotificationsRead(me.username);
  } else if (Array.isArray(body.ids)) {
    const ids = body.ids.filter((v): v is string => typeof v === "string");
    await markNotificationsRead(me.username, ids);
  } else {
    return NextResponse.json(
      { error: "Provide { ids: string[] } or { all: true }." },
      { status: 400 },
    );
  }

  const unread = await unreadCountForUser(me.username);
  return NextResponse.json({ ok: true, unread });
}
