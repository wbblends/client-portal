import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";

/**
 * Used by API route handlers to require a super-admin. Returns the user when
 * authorized, or a 401/403 NextResponse otherwise.
 */
export async function requireSuperAdminApi(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const user = await getSession();
  if (!user) {
    return { response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  if (user.role !== "super_admin") {
    return { response: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { user };
}
