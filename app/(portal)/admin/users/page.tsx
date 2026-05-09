import Link from "next/link";
import { Plus, Mail, KeyRound, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/users/store";
import { listDashboards, getDashboardById } from "@/lib/dashboards/registry";
import { listCustomers, getCustomer } from "@/lib/customers/registry";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { TeamAvatar } from "@/components/portal/team-avatar";

export const metadata = { title: "Users — WB Blends Admin" };

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const users = await listUsers();
  const dashboardsRegistry = listDashboards();
  const customersRegistry = listCustomers();

  return (
    <div
      className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7"
      style={{ maxWidth: "1200px" }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Admin</p>
          <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
            Users
          </h1>
          <p className="mt-1 text-sm text-muted">
            Create accounts, set permissions, and resend invites. New users get an email with a
            link to choose their own password.
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 select-none whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm h-10 px-4 text-sm"
        >
          <Plus className="h-4 w-4" />
          New user
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current users ({users.length})</CardTitle>
          <CardDescription>
            {dashboardsRegistry.length} cross-customer dashboards · {customersRegistry.length}{" "}
            customers in the registry. Permissions update immediately on save — no redeploy
            needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-accent/30 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="text-left font-medium px-6 py-2 w-12"></th>
                  <th className="text-left font-medium px-3 py-2">User</th>
                  <th className="text-left font-medium px-3 py-2">Role</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-left font-medium px-3 py-2">Customers</th>
                  <th className="text-left font-medium px-6 py-2">Dashboards</th>
                  <th className="text-right font-medium px-3 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(u => {
                  return (
                    <tr key={u.username} className="align-top">
                      <td className="px-6 py-3">
                        <TeamAvatar src={u.avatarUrl} name={u.name} size={32} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-foreground">{u.name}</div>
                        <div className="text-xs text-muted">{u.email}</div>
                        <div className="text-[11px] text-muted-soft font-mono mt-0.5">
                          {u.username}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          tone={
                            u.role === "admin"
                              ? "info"
                              : u.role === "internal"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          {!u.active && <Badge tone="danger">Deactivated</Badge>}
                          {u.active && !u.hasPassword && (
                            <span className="inline-flex items-center gap-1 text-xs text-warning">
                              <Mail className="h-3 w-3" /> Invite pending
                            </span>
                          )}
                          {u.active && u.hasPassword && (
                            <span className="inline-flex items-center gap-1 text-xs text-success">
                              <KeyRound className="h-3 w-3" /> Active
                            </span>
                          )}
                          {u.mfaEnabled && (
                            <span className="inline-flex items-center gap-1 text-xs text-foreground-soft">
                              <ShieldCheck className="h-3 w-3" /> 2FA on
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {u.role !== "customer" ? (
                          <span className="text-xs text-muted">all</span>
                        ) : u.customerIds.length === 0 ? (
                          <span className="text-xs text-muted">none</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {u.customerIds.map(id => {
                              const c = getCustomer(id);
                              return (
                                <Badge key={id} tone="neutral">
                                  {c?.name ?? id}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {u.dashboards.length === 0 ? (
                            <span className="text-xs text-muted">none</span>
                          ) : (
                            u.dashboards.map(id => {
                              const d = getDashboardById(id);
                              return (
                                <Badge key={id} tone="neutral">
                                  {d?.name ?? id}
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <UserRowActions
                          username={u.username}
                          active={u.active}
                          hasPassword={u.hasPassword}
                          mfaEnabled={u.mfaEnabled}
                          isSelf={u.username === me.username}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
