import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { attemptLogin, createSession, setMfaChallenge } from "@/lib/auth";
import { isSafeNextPath } from "@/lib/utils";

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

  const result = await attemptLogin(username, password);
  if (result.kind === "invalid") {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const next = isSafeNextPath(body.next) ? body.next! : "/";
  const remember = !!body.remember;

  if (result.kind === "mfa-required") {
    await setMfaChallenge(result.username, remember);
    return NextResponse.json({ ok: true, mfaRequired: true, next });
  }

  await createSession(result.user, remember);
  return NextResponse.json({ ok: true, next });
}
