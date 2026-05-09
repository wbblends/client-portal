import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteThread, getThread, setThreadResolved } from "@/lib/comments/store";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/comments/threads/[threadId]">,
) {
  await requireSession();
  const { threadId } = await ctx.params;
  const thread = await getThread(threadId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { resolved?: boolean };
  if (typeof body.resolved !== "boolean") {
    return NextResponse.json({ error: "Field `resolved` (boolean) required." }, { status: 400 });
  }
  await setThreadResolved(threadId, body.resolved);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/comments/threads/[threadId]">,
) {
  // Anyone in the thread who can see the page can also delete the whole pin
  // — matches Figma's behavior for consistency. Tighten later if needed.
  const me = await requireSession();
  const { threadId } = await ctx.params;
  const thread = await getThread(threadId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }
  // Only the thread creator can delete the entire pin — prevents random
  // people from nuking discussions. Replies are still individually deletable
  // by their own author via the comment endpoint.
  if (thread.createdBy !== me.username) {
    return NextResponse.json({ error: "Only the pin creator can delete the thread." }, { status: 403 });
  }
  await deleteThread(threadId);
  return NextResponse.json({ ok: true });
}
