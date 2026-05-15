import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  deleteComment,
  deleteThread,
  editComment,
  getComment,
  getThread,
  isRootOnlyComment,
  resolveMentions,
} from "@/lib/comments/store";
import { notifyMentions, parseMentionHandles } from "@/lib/comments/mentions";
import { recordMentionNotifications } from "@/lib/notifications/store";

const MAX_BODY = 5000;

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/comments/[commentId]">,
) {
  const me = await requireSession();
  const { commentId } = await ctx.params;
  const existing = await getComment(commentId);
  if (!existing) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }
  if (existing.authorUsername !== me.username) {
    return NextResponse.json({ error: "You can only edit your own comments." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { body?: string };
  const text = (body.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Comment can't be empty." }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `Comment exceeds ${MAX_BODY} chars.` }, { status: 400 });
  }

  const handles = parseMentionHandles(text);
  const allMentions = await resolveMentions(handles);

  // Only fire emails for *new* mentions added in this edit — re-notifying on
  // unrelated edits would be noisy.
  const previousMentions = new Set(
    (await fetchExistingMentions(commentId)).map(u => u),
  );
  const newMentions = allMentions.filter(u => !previousMentions.has(u));

  await editComment({ commentId, body: text, mentions: allMentions });

  if (newMentions.length > 0) {
    const thread = await getThread(existing.threadId);
    if (thread) {
      await recordMentionNotifications({
        recipientUsernames: newMentions,
        actorUsername: me.username,
        commentId,
        threadId: thread.id,
        route: thread.route,
        body: text,
      });
      void notifyMentions({
        mentionedUsernames: newMentions,
        mentionerUsername: me.username,
        mentionerName: me.name,
        route: thread.route,
        threadId: thread.id,
        body: text,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/comments/[commentId]">,
) {
  const me = await requireSession();
  const { commentId } = await ctx.params;
  const existing = await getComment(commentId);
  if (!existing) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }
  if (existing.authorUsername !== me.username) {
    return NextResponse.json({ error: "You can only delete your own comments." }, { status: 403 });
  }
  // If this is the only comment in the thread, remove the whole pin so we
  // don't leave an orphan empty thread sitting on the page.
  if (await isRootOnlyComment(commentId)) {
    await deleteThread(existing.threadId);
    return NextResponse.json({ ok: true, deletedThread: true });
  }
  await deleteComment(commentId);
  return NextResponse.json({ ok: true });
}

async function fetchExistingMentions(commentId: string): Promise<string[]> {
  // Lightweight inline lookup — avoids exporting a one-off accessor from
  // store.ts. The set is bounded by parsed handles in the prior version.
  const { ensureDb } = await import("@/lib/db");
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT username FROM comment_mentions WHERE comment_id = ?`,
    args: [commentId],
  });
  return rows.map(r => r.username as string);
}
