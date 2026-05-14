import type { Dashboard } from "@/lib/dashboards/registry";
import { OrdersPortalGrid } from "./orders-portal-grid";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/users/store";
import { listOrdersRows } from "@/lib/orders/store";

/**
 * Orders Portal — internal sales view of POs by customer for the year.
 *
 * Today this is a fully editable, server-backed spreadsheet seeded with the
 * latest 2026 POs snapshot from the sales metrics workbook. Edits made by an
 * admin become visible to every other user on their next poll. Customer-role
 * users can't see this dashboard at all (gated by the dashboard registry);
 * non-admin internal users get a read-only view of the same numbers.
 */
export async function OrdersPortalDashboard({ dashboard }: { dashboard: Dashboard }) {
  const user = await requireSession();
  const canEdit = isAdminRole(user.role);
  const initialRows = await listOrdersRows();

  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-6">
      <div>
        <p className="text-sm text-muted">{dashboard.category}</p>
        <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
          {dashboard.name}
        </h1>
      </div>

      <OrdersPortalGrid initialRows={initialRows} canEdit={canEdit} />
    </div>
  );
}
