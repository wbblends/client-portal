import { redirect } from "next/navigation";

/**
 * Legacy redirect — the original single dashboard now lives at
 * `/dashboards/customer-overview`. Bouncing through `/` lets the index
 * pick the first dashboard the user has access to, so customers without
 * the customer-overview permission still land somewhere sensible.
 */
export default function LegacyDashboardRedirect() {
  redirect("/");
}
