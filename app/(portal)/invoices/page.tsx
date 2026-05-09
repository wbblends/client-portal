import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

/** Legacy redirect — Invoices moved under /c/[customerId]/invoices. */
export default async function LegacyInvoicesRedirect() {
  const user = await requireSession();
  const first = user.customerIds[0];
  if (first) redirect(`/c/${first}/invoices`);
  redirect("/");
}
