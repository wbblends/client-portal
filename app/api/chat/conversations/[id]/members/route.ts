import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  HttpError,
  getConversation,
  setChannelMembers,
} from "@/lib/chat/repository";
import { publish } from "@/lib/chat/events";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const conv = getConversation(id, user);
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ members: conv.members });
}

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { memberIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!Array.isArray(body.memberIds)) {
    return NextResponse.json({ error: "memberIds required" }, { status: 400 });
  }
  try {
    const conv = setChannelMembers(user, id, body.memberIds);
    publish({ kind: "members", conversationId: id, members: conv.members });
    publish({ kind: "conversation", conversation: conv });
    return NextResponse.json({ conversation: conv });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
