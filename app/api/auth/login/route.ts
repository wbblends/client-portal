import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, createSession } from "@/lib/auth";
import { isSameOrigin } from "@/lib/origin-check";
import { clientIp, consume } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/safe-redirect";

const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const ip = clientIp(request.headers);
  const limit = consume(`login:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let body: { username?: string; password?: string; remember?: boolean; next?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const user = await authenticate(username, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  await createSession(user, !!body.remember);

  const next = safeNextPath(body.next);
  return NextResponse.json({ ok: true, next });
}
