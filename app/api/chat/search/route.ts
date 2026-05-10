import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchMessages } from "@/lib/chat/repository";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const results = searchMessages(user, q);
  return NextResponse.json({ results });
}
