import { requireAdmin } from "@/lib/auth";
import { listTickets, getLastSyncedAt } from "@/lib/tickets/store";
import { TicketsBoard } from "@/components/admin/tickets-board";

export const metadata = { title: "Tickets — WB Blends Admin" };
export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  await requireAdmin();
  const tickets = await listTickets();
  const lastSyncedAt = await getLastSyncedAt();

  return (
    <div
      className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7"
      style={{ maxWidth: "1400px" }}
    >
      <div>
        <p className="text-sm text-muted">Admin</p>
        <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
          Tickets
        </h1>
        <p className="mt-1 text-sm text-muted">
          Open PM tickets imported daily at 7&nbsp;AM from the coworker job.
          Type a rank in the first column to reorder; click the swatch on a
          row to cycle red&nbsp;→&nbsp;white&nbsp;→&nbsp;gray. Rank and color
          survive each sync.
        </p>
      </div>

      <TicketsBoard initialTickets={tickets} initialLastSyncedAt={lastSyncedAt} />
    </div>
  );
}
