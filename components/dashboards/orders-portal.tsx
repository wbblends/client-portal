import type { Dashboard } from "@/lib/dashboards/registry";
import { OrdersPortalGrid } from "./orders-portal-grid";

/**
 * Orders Portal — internal sales view of POs by customer for the year.
 *
 * Today this is a fully editable, browser-persisted spreadsheet seeded with
 * the latest 2026 POs snapshot from the sales metrics workbook. It lets the
 * sales team (and Devin) update numbers and add new customers without
 * leaving the portal. Future: replace `ORDERS_PORTAL_SEED` with an
 * Acumatica fetch (`acumatica.salesOrders.byCustomer({ year })`) and route
 * edits through a mutation API.
 */
export function OrdersPortalDashboard({ dashboard }: { dashboard: Dashboard }) {
  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-6">
      <div>
        <p className="text-sm text-muted">{dashboard.category}</p>
        <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
          {dashboard.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Booked POs by customer for the year. Edits persist in your browser
          until the Acumatica integration takes over.
        </p>
      </div>

      <OrdersPortalGrid />
    </div>
  );
}
