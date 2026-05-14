import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { TICKET_TYPES } from "@/lib/tickets/registry";

/**
 * Bare `/admin/tickets` has no board of its own — each PM ticket type is its
 * own page under `/admin/tickets/<slug>`. Land on the first type.
 */
export default async function AdminTicketsIndexPage() {
  await requireAdmin();
  redirect(`/admin/tickets/${TICKET_TYPES[0].slug}`);
}
