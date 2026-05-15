import { requireAdmin } from "@/lib/auth";
import { listTickets, getLastSyncedAt } from "@/lib/tickets/store";
import { TicketsAnalytics } from "@/components/admin/tickets-analytics";

export const dynamic = "force-dynamic";

/**
 * PM ticket analytics — an aggregate roll-up across every ticket type. This
 * is a static route, so it resolves ahead of the sibling `[tab]` dynamic
 * route (a request for `/admin/tickets/analytics` lands here, not on the
 * per-type board). The board pages stay per-type; this one sums them up.
 */
export default async function AdminTicketsAnalyticsPage() {
  await requireAdmin();

  const tickets = await listTickets();
  const lastSyncedAt = await getLastSyncedAt();

  return (
    <div
      className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7"
      style={{ maxWidth: "1400px" }}
    >
      <div>
        <p className="text-sm text-muted">Project Management</p>
        <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
          Analytics
        </h1>
      </div>

      <TicketsAnalytics
        initialTickets={tickets}
        initialLastSyncedAt={lastSyncedAt}
      />
    </div>
  );
}

export const metadata = {
  title: "Analytics — WB Blends Admin",
};
