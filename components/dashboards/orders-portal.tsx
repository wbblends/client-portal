import type { Dashboard } from "@/lib/dashboards/registry";
import { OrdersPortalYears } from "./orders-portal-years";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/users/store";
import { listOrdersRows } from "@/lib/orders/store";
import { PO_YEARS } from "@/lib/data/orders-portal";

/**
 * Orders Portal — internal sales view of POs by customer, one tab per year.
 *
 * Each year is a fully editable, server-backed spreadsheet seeded from the
 * matching tab of the sales metrics workbook (2026 POs, 2025 POs). Edits made
 * by an admin become visible to every other user on their next poll.
 * Customer-role users can't see this dashboard at all (gated by the dashboard
 * registry); non-admin internal users get a read-only view of the same
 * numbers.
 */
export async function OrdersPortalDashboard({ dashboard }: { dashboard: Dashboard }) {
  const user = await requireSession();
  const canEdit = isAdminRole(user.role);
  const years = await Promise.all(
    PO_YEARS.map(async year => ({ year, rows: await listOrdersRows(year) })),
  );

  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-6">
      <div>
        <p className="text-sm text-muted">{dashboard.category}</p>
        <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
          {dashboard.name}
        </h1>
      </div>

      <OrdersPortalYears years={years} canEdit={canEdit} />
    </div>
  );
}
