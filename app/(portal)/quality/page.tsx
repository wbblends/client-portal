import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

/** Legacy redirect — Quality moved under /c/[customerId]/quality. */
export default async function LegacyQualityRedirect() {
  const user = await requireSession();
  const first = user.customerIds[0];
  if (first) redirect(`/c/${first}/quality`);
  redirect("/");
}
