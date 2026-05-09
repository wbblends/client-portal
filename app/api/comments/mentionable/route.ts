import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listMentionableUsers } from "@/lib/comments/store";

export async function GET() {
  await requireSession();
  const users = await listMentionableUsers();
  return NextResponse.json({ users });
}
