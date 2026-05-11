import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  createUser,
  getUser,
  getUserByEmail,
  type CustomerAssignment,
  type CustomerPermission,
  type UserRole,
} from "@/lib/users/store";
import { createToken } from "@/lib/auth/tokens";
import { sendEmail, publicBaseUrl } from "@/lib/email/sender";
import { inviteEmail } from "@/lib/email/templates";
import { listDashboards } from "@/lib/dashboards/registry";
import { listCustomers } from "@/lib/customers/registry";

const ALLOWED_ROLES: UserRole[] = ["super_admin", "admin", "internal", "customer"];
const ALLOWED_PERMISSIONS: CustomerPermission[] = ["viewer", "editor"];

/** Normalizes a request body's customer assignments. Accepts the new
 *  `customers: [{id, permission}]` shape and the legacy `customerIds: [id]`
 *  shape (which defaults each entry to viewer). Filters out unknown
 *  customer ids and unknown permission values. */
function readCustomerAssignments(
  body: { customers?: unknown; customerIds?: unknown },
  validIds: Set<string>,
): CustomerAssignment[] {
  if (Array.isArray(body.customers)) {
    const out: CustomerAssignment[] = [];
    for (const raw of body.customers) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as { id?: unknown; permission?: unknown };
      if (typeof r.id !== "string" || !validIds.has(r.id)) continue;
      const permission =
        typeof r.permission === "string" &&
        (ALLOWED_PERMISSIONS as string[]).includes(r.permission)
          ? (r.permission as CustomerPermission)
          : "viewer";
      out.push({ id: r.id, permission });
    }
    return out;
  }
  if (Array.isArray(body.customerIds)) {
    return body.customerIds
      .filter((id): id is string => typeof id === "string" && validIds.has(id))
      .map(id => ({ id, permission: "viewer" as const }));
  }
  return [];
}

export async function POST(request: NextRequest) {
  const me = await requireAdmin();

  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    email?: string;
    name?: string;
    company?: string;
    role?: string;
    customers?: Array<{ id: string; permission?: CustomerPermission }>;
    customerIds?: string[];
    dashboards?: string[];
    avatarUrl?: string | null;
  };

  const username = (body.username ?? "").trim().toLowerCase();
  const email = (body.email ?? "").trim();
  const name = (body.name ?? "").trim();
  const company = (body.company ?? "").trim();
  const role = body.role as UserRole | undefined;

  if (!username || !email || !name || !company || !role) {
    return NextResponse.json(
      { error: "Username, email, name, company, and role are required." },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9._-]{2,40}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 2-40 chars: lowercase letters, digits, dot, underscore, or hyphen." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  if (await getUser(username)) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }
  if (await getUserByEmail(email)) {
    return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
  }

  const validDashboardIds = new Set(listDashboards().map(d => d.id));
  const validCustomerIds = new Set(listCustomers().map(c => c.id));
  const dashboards = (body.dashboards ?? []).filter(id => validDashboardIds.has(id));
  const customers = readCustomerAssignments(body, validCustomerIds);

  const user = await createUser({
    username,
    email,
    name,
    company,
    role,
    customers,
    dashboards,
    avatarUrl: body.avatarUrl ?? null,
  });

  // Send the invite email.
  const token = await createToken(user.username, "invite");
  const url = `${publicBaseUrl()}/auth/set-password?token=${encodeURIComponent(token)}`;
  const msg = inviteEmail({ name: user.name, inviteUrl: url, inviterName: me.name });
  try {
    await sendEmail({ to: user.email, ...msg });
  } catch (err) {
    console.error("[admin/users] failed to send invite email", err);
  }

  return NextResponse.json({ ok: true, username: user.username });
}
