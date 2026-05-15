import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  listNotificationsForUser,
  unreadCountForUser,
} from "@/lib/notifications/store";

/** GET — recent notifications for the current user plus an unread count.
 *  Used by the bell dropdown's initial load and polling refresh. */
export async function GET() {
  const me = await requireSession();
  const [items, unread] = await Promise.all([
    listNotificationsForUser(me.username, 20),
    unreadCountForUser(me.username),
  ]);
  return NextResponse.json({ items, unread });
}
