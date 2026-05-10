import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  consumeInvite,
  createUser,
  DEFAULT_CUSTOMER_PERMISSIONS,
  getCustomer,
  getUserByUsername,
} from "@/lib/data/store";
import { createSession, toSessionUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: {
    token?: string;
    username?: string;
    password?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!token) return NextResponse.json({ error: "Missing invite token." }, { status: 400 });
  if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–32 chars (lowercase letters, digits, . _ -)." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  if (await getUserByUsername(username)) {
    return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
  }

  const invite = await consumeInvite(token);
  if (!invite) {
    return NextResponse.json(
      { error: "Invite link is invalid or has expired." },
      { status: 400 },
    );
  }

  const customer = await getCustomer(invite.customerId);
  if (!customer) {
    return NextResponse.json(
      { error: "The customer for this invite no longer exists." },
      { status: 410 },
    );
  }

  const stored = await createUser({
    username,
    password,
    name: invite.name,
    email: invite.email,
    customerId: invite.customerId,
    role: "customer_user",
    permissions: [...DEFAULT_CUSTOMER_PERMISSIONS],
  });

  await createSession(toSessionUser(stored), true);
  return NextResponse.json({ ok: true, next: "/dashboard" });
}
