import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { HttpError, markRead } from "@/lib/chat/repository";
import { publish } from "@/lib/chat/events";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { upTo?: number } = {};
  try {
    body = await request.json();
  } catch {
    /* allow empty body — defaults to now */
  }
  try {
    const lastReadAt = markRead(id, user, body.upTo);
    publish({ kind: "read", conversationId: id, userId: user.id, lastReadAt });
    return NextResponse.json({ lastReadAt });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
