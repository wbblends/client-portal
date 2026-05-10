import { requireSuperAdmin } from "@/lib/auth";
import { listCustomers, listUsers } from "@/lib/data/store";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CustomerAdminList } from "@/components/admin/customer-admin-list";

export const metadata = { title: "Customers — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requireSuperAdmin();
  const [customers, users] = await Promise.all([listCustomers(), listUsers()]);

  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Customers</h1>
        <p className="mt-1 text-sm text-muted">
          Manage customer profiles, branding, and portal access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All customers</CardTitle>
          <CardDescription>
            Click the pencil to edit a customer&apos;s contact details, branding, and users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerAdminList customers={customers} users={users} />
        </CardContent>
      </Card>
    </div>
  );
}
