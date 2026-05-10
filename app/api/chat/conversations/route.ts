import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  HttpError,
  createGroup,
  findOrCreateDM,
  listConversations,
  totalUnread,
} from "@/lib/chat/repository";
import { publish } from "@/lib/chat/events";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversations = listConversations(user);
  return NextResponse.json({ conversations, totalUnread: totalUnread(user) });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    type?: "dm" | "group";
    memberIds?: string[];
    title?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    if (body.type === "dm") {
      const otherId = body.memberIds?.[0];
      if (!otherId) {
        return NextResponse.json({ error: "memberIds required" }, { status: 400 });
      }
      const conv = findOrCreateDM(user, otherId);
      publish({ kind: "conversation", conversation: conv });
      return NextResponse.json({ conversation: conv });
    }
    if (body.type === "group") {
      const memberIds = body.memberIds ?? [];
      const conv = createGroup(user, memberIds, body.title);
      publish({ kind: "conversation", conversation: conv });
      return NextResponse.json({ conversation: conv });
    }
    return NextResponse.json({ error: "type must be 'dm' or 'group'" }, { status: 400 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
