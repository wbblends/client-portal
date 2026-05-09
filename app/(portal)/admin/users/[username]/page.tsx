import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getUser } from "@/lib/users/store";
import { listDashboards } from "@/lib/dashboards/registry";
import { listCustomers } from "@/lib/customers/registry";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { UserForm } from "@/components/admin/user-form";

export const metadata = { title: "Edit user — WB Blends Admin" };

export default async function EditUserPage(props: PageProps<"/admin/users/[username]">) {
  await requireAdmin();
  const { username } = await props.params;
  const user = await getUser(username);
  if (!user) notFound();

  const dashboards = listDashboards().map(d => ({
    id: d.id,
    name: d.name,
    category: d.category,
  }));
  const customers = listCustomers().map(c => ({ id: c.id, name: c.name }));

  return (
    <div
      className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7"
      style={{ maxWidth: "900px" }}
    >
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to users
      </Link>

      <div>
        <p className="text-sm text-muted">Admin</p>
        <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
          {user.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Editing <code className="rounded bg-accent px-1 py-0.5 text-xs">{user.username}</code>{" "}
          — changes take effect immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User details</CardTitle>
          <CardDescription>
            Username is fixed once a user is created; everything else is editable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm
            dashboards={dashboards}
            customers={customers}
            editing={{ username: user.username }}
            initial={{
              username: user.username,
              email: user.email,
              name: user.name,
              company: user.company,
              role: user.role,
              customerIds: user.customerIds,
              dashboards: user.dashboards,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
