import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

/** Legacy redirect — Documents moved under /c/[customerId]/documents. */
export default async function LegacyDocumentsRedirect() {
  const user = await requireSession();
  const first = user.customerIds[0];
  if (first) redirect(`/c/${first}/documents`);
  redirect("/");
}
