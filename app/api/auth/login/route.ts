import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string; remember?: boolean; next?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = body.username ?? "";
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const user = await authenticate(username, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  await createSession(user, !!body.remember);

  const next = body.next && body.next.startsWith("/") ? body.next : "/dashboard";
  return NextResponse.json({ ok: true, next });
}
