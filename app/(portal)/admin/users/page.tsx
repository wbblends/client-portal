import Link from "next/link";
import { Plus, Mail, KeyRound, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listUsers, type UserRole } from "@/lib/users/store";
import { listDashboards, getDashboardById } from "@/lib/dashboards/registry";
import { listCustomers, getCustomer } from "@/lib/customers/registry";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { TeamAvatar } from "@/components/portal/team-avatar";
import { FilterBar } from "@/components/filters/filter-bar";
import { SortableHeader } from "@/components/filters/sortable-header";
import { readEnum, readSort, readString } from "@/lib/filters/url-state";
import { applyEnumEquals, applySort, applyTextSearch } from "@/lib/filters/apply";

export const metadata = { title: "Users — WB Blends Admin" };

const USER_ROLES: UserRole[] = ["super_admin", "admin", "internal", "customer"];
const USER_STATUSES = ["active", "invite_pending", "deactivated"] as const;
const USER_SORT_COLUMNS = ["name", "role", "status", "created"] as const;

type UserStatus = (typeof USER_STATUSES)[number];

function statusOf(u: { active: boolean; hasPassword: boolean }): UserStatus {
  if (!u.active) return "deactivated";
  return u.hasPassword ? "active" : "invite_pending";
}

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  internal: "Internal",
  customer: "Customer",
};

const STATUS_LABEL: Record<UserStatus, string> = {
  active: "Active",
  invite_pending: "Invite pending",
  deactivated: "Deactivated",
};

export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  const me = await requireAdmin();
  const sp = await props.searchParams;
  const all = await listUsers();
  const dashboardsRegistry = listDashboards();
  const customersRegistry = listCustomers();

  const query = readString(sp, "q");
  const role = readEnum<UserRole>(sp, "role", USER_ROLES);
  const status = readEnum<UserStatus>(sp, "status", USER_STATUSES);
  const sort = readSort(sp, USER_SORT_COLUMNS, { column: "created", direction: "desc" });

  let users = applyTextSearch(all, query, [u => u.name, u => u.email, u => u.username]);
  users = applyEnumEquals(users, role, u => u.role);
  if (status) users = users.filter(u => statusOf(u) === status);
  users = applySort(
    users,
    u => {
      switch (sort.column) {
        case "name":
          return u.name.toLowerCase();
        case "role":
          return u.role;
        case "status":
          return statusOf(u);
        case "created":
          return u.createdAt;
      }
    },
    sort.direction,
  );

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
        <Link href="/admin/users/new" className={buttonClasses({ size: "md" })}>
          <Plus className="h-4 w-4" />
          New user
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Current users (
            {users.length === all.length ? all.length : `${users.length} of ${all.length}`})
          </CardTitle>
          <CardDescription>
            {dashboardsRegistry.length} cross-customer dashboards · {customersRegistry.length}{" "}
            customers in the registry. Permissions update immediately on save — no redeploy
            needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-0">
          <div className="px-4 sm:px-6">
            <FilterBar
              search={{ param: "q", placeholder: "Search name, email, or username…" }}
              selects={[
                {
                  kind: "select",
                  param: "role",
                  label: "Role",
                  options: [
                    { value: "", label: "All roles" },
                    ...USER_ROLES.map(r => ({ value: r, label: ROLE_LABEL[r] })),
                  ],
                },
                {
                  kind: "select",
                  param: "status",
                  label: "Status",
                  options: [
                    { value: "", label: "Any status" },
                    ...USER_STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] })),
                  ],
                },
              ]}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-accent/30 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="text-left font-medium px-6 py-2 w-12">
                    <span className="sr-only">Avatar</span>
                  </th>
                  <SortableHeader column="name" label="User" className="text-left px-3 py-2" />
                  <SortableHeader column="role" label="Role" className="text-left px-3 py-2" />
                  <SortableHeader column="status" label="Status" className="text-left px-3 py-2" />
                  <th scope="col" className="text-left font-medium px-3 py-2">Customers</th>
                  <th scope="col" className="text-left font-medium px-6 py-2">Dashboards</th>
                  <th scope="col" className="text-right font-medium px-3 py-2 w-12">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-muted">
                      No users match the current filters.
                    </td>
                  </tr>
                ) : users.map(u => {
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
                            u.role === "super_admin"
                              ? "success"
                              : u.role === "admin"
                                ? "info"
                                : u.role === "internal"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {u.role === "super_admin" ? "super admin" : u.role}
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
                          <span className="text-xs text-muted">all (editor)</span>
                        ) : u.customerIds.length === 0 ? (
                          <span className="text-xs text-muted">none</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {u.customerIds.map(id => {
                              const c = getCustomer(id);
                              const perm = u.customerPermissions[id] ?? "viewer";
                              return (
                                <Badge
                                  key={id}
                                  tone={perm === "editor" ? "info" : "neutral"}
                                  title={`${c?.name ?? id} — ${perm}`}
                                >
                                  {c?.name ?? id}
                                  <span className="text-[10px] uppercase tracking-wider opacity-70">
                                    {perm === "editor" ? "Editor" : "Viewer"}
                                  </span>
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
