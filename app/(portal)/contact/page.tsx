import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

/** Legacy redirect — Contact moved under /c/[customerId]/contact. */
export default async function LegacyContactRedirect() {
  const user = await requireSession();
  const first = user.customerIds[0];
  if (first) redirect(`/c/${first}/contact`);
  redirect("/");
}
