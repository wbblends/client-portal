import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDashboardsForUser } from "@/lib/dashboards/registry";
import { listCustomers } from "@/lib/customers/registry";
import { isAdminRole } from "@/lib/users/store";

/**
 * Post-login landing logic. Picks where to send each user based on role:
 *  - customer (with at least one customerId): first one's /c/<id>/overview
 *  - admin/super_admin/internal: first registered customer's overview
 *  - any user with no customer + no dashboards: /admin/users (admins) or
 *    /no-access (everyone else)
 */
export default async function Index() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.customerIds.length > 0) {
    redirect(`/c/${session.customerIds[0]}/overview`);
  }

  if (isAdminRole(session.role) || session.role === "internal") {
    const first = listCustomers()[0];
    if (first) redirect(`/c/${first.id}/overview`);
  }

  const allowed = getDashboardsForUser(session.dashboards, session.role);
  if (allowed.length > 0) redirect(`/dashboards/${allowed[0].slug}`);

  if (isAdminRole(session.role)) redirect("/admin/users");
  redirect("/no-access");
}
