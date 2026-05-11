import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  deleteUser,
  getUser,
  getUserByEmail,
  updateUser,
  type CustomerAssignment,
  type CustomerPermission,
  type UserRole,
} from "@/lib/users/store";
import { listDashboards } from "@/lib/dashboards/registry";
import { listCustomers } from "@/lib/customers/registry";

const ALLOWED_ROLES: UserRole[] = ["super_admin", "admin", "internal", "customer"];
const ADMIN_LIKE_ROLES: UserRole[] = ["super_admin", "admin"];
const ALLOWED_PERMISSIONS: CustomerPermission[] = ["viewer", "editor"];

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/users/[username]">,
) {
  const me = await requireAdmin();
  const { username } = await ctx.params;
  const target = await getUser(username);
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    company?: string;
    role?: string;
    customers?: Array<{ id: string; permission?: CustomerPermission }>;
    customerIds?: string[];
    dashboards?: string[];
    avatarUrl?: string | null;
    active?: boolean;
  };

  const patch: Parameters<typeof updateUser>[1] = {};

  if (body.email !== undefined) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }
    const conflict = await getUserByEmail(body.email);
    if (conflict && conflict.username !== target.username) {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
    patch.email = body.email;
  }
  if (body.name !== undefined) patch.name = body.name;
  if (body.company !== undefined) patch.company = body.company;
  if (body.role !== undefined) {
    if (!ALLOWED_ROLES.includes(body.role as UserRole)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }
    // An admin can't demote themselves out of admin-like roles — that's a
    // foot-gun. To remove the last admin, do it through a DB tool, not the UI.
    if (
      target.username === me.username &&
      !ADMIN_LIKE_ROLES.includes(body.role as UserRole)
    ) {
      return NextResponse.json(
        { error: "You can't remove your own admin role." },
        { status: 400 },
      );
    }
    patch.role = body.role as UserRole;
  }
  if (body.customers !== undefined || body.customerIds !== undefined) {
    const validIds = new Set(listCustomers().map(c => c.id));
    const assignments: CustomerAssignment[] = [];
    if (Array.isArray(body.customers)) {
      for (const raw of body.customers) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as { id?: unknown; permission?: unknown };
        if (typeof r.id !== "string" || !validIds.has(r.id)) continue;
        const permission =
          typeof r.permission === "string" &&
          (ALLOWED_PERMISSIONS as string[]).includes(r.permission)
            ? (r.permission as CustomerPermission)
            : "viewer";
        assignments.push({ id: r.id, permission });
      }
    } else if (Array.isArray(body.customerIds)) {
      for (const id of body.customerIds) {
        if (typeof id === "string" && validIds.has(id)) {
          assignments.push({ id, permission: "viewer" });
        }
      }
    }
    patch.customers = assignments;
  }
  if (body.dashboards !== undefined) {
    const valid = new Set(listDashboards().map(d => d.id));
    patch.dashboards = body.dashboards.filter(id => valid.has(id));
  }
  if (body.avatarUrl !== undefined) patch.avatarUrl = body.avatarUrl;
  if (body.active !== undefined) {
    if (target.username === me.username && !body.active) {
      return NextResponse.json(
        { error: "You can't deactivate your own account." },
        { status: 400 },
      );
    }
    patch.active = body.active;
  }

  const updated = await updateUser(target.username, patch);
  return NextResponse.json({ ok: true, user: serialize(updated) });
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/users/[username]">,
) {
  const me = await requireAdmin();
  const { username } = await ctx.params;
  if (username === me.username) {
    return NextResponse.json(
      { error: "You can't delete your own account." },
      { status: 400 },
    );
  }
  const target = await getUser(username);
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  await deleteUser(target.username);
  return NextResponse.json({ ok: true });
}

function serialize(u: Awaited<ReturnType<typeof getUser>>) {
  if (!u) return null;
  return {
    username: u.username,
    email: u.email,
    name: u.name,
    company: u.company,
    role: u.role,
    customerIds: u.customerIds,
    customerPermissions: u.customerPermissions,
    customers: u.customerIds.map(id => ({
      id,
      permission: u.customerPermissions[id] ?? "viewer",
    })),
    dashboards: u.dashboards,
    avatarUrl: u.avatarUrl,
    hasPassword: u.hasPassword,
    active: u.active,
    mfaEnabled: u.mfaEnabled,
  };
}
