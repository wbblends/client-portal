import Link from "next/link";
import { Plus, History } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { listUsers, ROLE_LABELS, type Role } from "@/lib/users";
import { Card } from "@/components/ui/card";
import type { BadgeTone } from "@/components/ui/badge";
import { UsersListFilter } from "./_components/users-list-filter";

export const metadata = { title: "Users — WB Blends Admin" };

const roleTone: Record<Role, BadgeTone> = {
  super_admin: "info",
  admin: "warning",
  user: "neutral",
};

export default async function UsersPage() {
  const me = await requireSuperAdmin();
  const users = listUsers();

  const totals = {
    all: users.length,
    super_admin: users.filter(u => u.role === "super_admin").length,
    admin: users.filter(u => u.role === "admin").length,
    user: users.filter(u => u.role === "user").length,
    disabled: users.filter(u => u.status === "disabled").length,
  };

  const rows = users.map(u => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role],
    roleTone: roleTone[u.role],
    status: u.status,
    permissionsCount: u.permissions.length,
    twoFactorEnabled: u.twoFactorEnabled,
    isMe: u.id === me.id,
  }));

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[34px] leading-[1.1] tracking-tight text-foreground">
            <em className="not-italic text-primary">Users</em>.
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage every activated account — names, emails, profile photos, roles, permissions,
            and passwords. Changes apply on the user&apos;s next page load.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/audit"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 h-10 text-sm font-medium text-foreground-soft hover:border-border-strong hover:bg-accent transition-colors"
          >
            <History className="h-4 w-4" />
            Activity log
          </Link>
          <Link
            href="/admin/users/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 h-10 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New user
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total users" value={totals.all} />
        <Stat label="Super admins" value={totals.super_admin} />
        <Stat label="Admins" value={totals.admin} />
        <Stat label="Disabled" value={totals.disabled} tone={totals.disabled > 0 ? "warning" : "neutral"} />
      </div>

      <Card className="overflow-hidden">
        <UsersListFilter rows={rows} />
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card className="px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div
        className={
          "mt-1 text-2xl font-semibold tabular-nums " +
          (tone === "warning" ? "text-warning" : "text-foreground")
        }
      >
        {value}
      </div>
    </Card>
  );
}

