import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  createThread,
  listThreadsForRoute,
  resolveMentions,
} from "@/lib/comments/store";
import { notifyMentions, parseMentionHandles } from "@/lib/comments/mentions";
import { recordMentionNotifications } from "@/lib/notifications/store";

const MAX_BODY = 5000;

export async function GET(request: NextRequest) {
  await requireSession();
  const route = (request.nextUrl.searchParams.get("route") ?? "").trim();
  if (!route || !route.startsWith("/")) {
    return NextResponse.json({ error: "Missing or invalid route." }, { status: 400 });
  }
  const threads = await listThreadsForRoute(route);
  return NextResponse.json({ threads });
}

export async function POST(request: NextRequest) {
  const me = await requireSession();
  const body = (await request.json().catch(() => ({}))) as {
    route?: string;
    anchorXPct?: number;
    anchorYPx?: number;
    body?: string;
  };

  const route = (body.route ?? "").trim();
  const text = (body.body ?? "").trim();
  const x = Number(body.anchorXPct);
  const y = Number(body.anchorYPx);

  if (!route || !route.startsWith("/")) {
    return NextResponse.json({ error: "Missing or invalid route." }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Comment can't be empty." }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `Comment exceeds ${MAX_BODY} chars.` }, { status: 400 });
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return NextResponse.json({ error: "Invalid anchor coordinates." }, { status: 400 });
  }

  const handles = parseMentionHandles(text);
  const mentions = await resolveMentions(handles);

  const { threadId, commentId } = await createThread({
    route,
    anchorXPct: x,
    anchorYPx: y,
    body: text,
    authorUsername: me.username,
    mentions,
  });

  // In-app notification rows are awaited (local DB write, cheap) so the
  // bell stays consistent with what shipped. Emails stay fire-and-forget —
  // don't block the API response on Resend.
  await recordMentionNotifications({
    recipientUsernames: mentions,
    actorUsername: me.username,
    commentId,
    threadId,
    route,
    body: text,
  });
  void notifyMentions({
    mentionedUsernames: mentions,
    mentionerUsername: me.username,
    mentionerName: me.name,
    route,
    threadId,
    body: text,
  });

  return NextResponse.json({ ok: true, threadId, commentId });
}
