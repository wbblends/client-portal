import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listTickets, getLastSyncedAt } from "@/lib/tickets/store";
import { getTicketType } from "@/lib/tickets/registry";
import { TicketsBoard } from "@/components/admin/tickets-board";

export const dynamic = "force-dynamic";

/**
 * One page per PM ticket type. The `[tab]` slug is looked up in the ticket
 * registry; the board is filtered to that type's rows. The customer /
 * product / salesperson / status filter bar is shared across every type.
 */
export default async function AdminTicketTypePage(
  props: PageProps<"/admin/tickets/[tab]">,
) {
  await requireAdmin();
  const { tab } = await props.params;

  const ticketType = getTicketType(tab);
  if (!ticketType) notFound();

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
          {ticketType.label}
        </h1>
      </div>

      <TicketsBoard
        activeTab={ticketType.tab}
        initialTickets={tickets}
        initialLastSyncedAt={lastSyncedAt}
      />
    </div>
  );
}

export async function generateMetadata(
  props: PageProps<"/admin/tickets/[tab]">,
) {
  const { tab } = await props.params;
  const ticketType = getTicketType(tab);
  return {
    title: ticketType
      ? `${ticketType.label} — WB Blends Admin`
      : "Tickets — WB Blends Admin",
  };
}
