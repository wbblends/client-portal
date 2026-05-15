import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { addReply, getThread, resolveMentions } from "@/lib/comments/store";
import { notifyMentions, parseMentionHandles } from "@/lib/comments/mentions";
import { recordMentionNotifications } from "@/lib/notifications/store";

const MAX_BODY = 5000;

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/comments/threads/[threadId]/replies">,
) {
  const me = await requireSession();
  const { threadId } = await ctx.params;

  const thread = await getThread(threadId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { body?: string };
  const text = (body.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Reply can't be empty." }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `Reply exceeds ${MAX_BODY} chars.` }, { status: 400 });
  }

  const handles = parseMentionHandles(text);
  const mentions = await resolveMentions(handles);

  const commentId = await addReply({
    threadId,
    body: text,
    authorUsername: me.username,
    mentions,
  });

  await recordMentionNotifications({
    recipientUsernames: mentions,
    actorUsername: me.username,
    commentId,
    threadId,
    route: thread.route,
    body: text,
  });
  void notifyMentions({
    mentionedUsernames: mentions,
    mentionerUsername: me.username,
    mentionerName: me.name,
    route: thread.route,
    threadId,
    body: text,
  });

  return NextResponse.json({ ok: true, commentId });
}
