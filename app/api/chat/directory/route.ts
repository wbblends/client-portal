import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listUsers } from "@/lib/chat/repository";
import { db } from "@/lib/db";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "internal" | "external";
  customer_id: string | null;
  company: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
};

/**
 * GET /api/chat/directory
 *   Default: users the viewer can chat with (members of shared conversations
 *   for externals; everyone for internals).
 *
 *   ?scope=all  Super admin only — returns every user; used by the channel
 *               membership manager.
 */
export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");

  if (scope === "all") {
    if (user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rows = db()
      .prepare("SELECT * FROM users ORDER BY company, name")
      .all() as UserRow[];
    const users = rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      customerId: r.customer_id,
      company: r.company ?? "",
      avatarUrl: r.avatar_url ?? undefined,
      avatarColor: r.avatar_color ?? undefined,
    }));
    return NextResponse.json({ users });
  }

  return NextResponse.json({ users: listUsers(user) });
}
