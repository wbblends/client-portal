import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listDashboards } from "@/lib/dashboards/registry";
import { listCustomers } from "@/lib/customers/registry";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { UserForm } from "@/components/admin/user-form";

export const metadata = { title: "New user — WB Blends Admin" };

export default async function NewUserPage() {
  await requireAdmin();
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
          New user
        </h1>
        <p className="mt-1 text-sm text-muted">
          Fill out the form below. The user will receive an invite email with a link to set
          their own password — they should arrive within a minute.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User details</CardTitle>
          <CardDescription>
            Permissions take effect immediately and can be changed any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm dashboards={dashboards} customers={customers} />
        </CardContent>
      </Card>
    </div>
  );
}
