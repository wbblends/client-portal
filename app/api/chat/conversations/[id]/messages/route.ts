import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  HttpError,
  getConversation,
  listMessages,
  sendMessage,
} from "@/lib/chat/repository";
import { publish } from "@/lib/chat/events";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const before = Number(url.searchParams.get("before") ?? "") || undefined;
  const limit = Number(url.searchParams.get("limit") ?? "") || undefined;
  try {
    const messages = listMessages(id, user, { before, limit });
    return NextResponse.json({ messages });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  let body: {
    body?: string;
    attachmentIds?: string[]; // not used; uploads embed metadata directly
    attachments?: Array<{
      fileName: string;
      mimeType: string;
      size: number;
      storagePath: string;
    }>;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const msg = sendMessage(id, user, body.body ?? "", body.attachments ?? []);
    publish({ kind: "message", conversationId: id, message: msg });
    // Bump conversation last_message_at into the convo summary subscribers can refresh.
    const refreshed = getConversation(id, user);
    if (refreshed) publish({ kind: "conversation", conversation: refreshed });
    return NextResponse.json({ message: msg });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
