import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/**
 * Post-login landing logic. Every authenticated user lands on /home — the
 * portal homepage. Unauthenticated visitors bounce to /login. Role-specific
 * routing (per-customer overviews, dashboards, admin) now happens via the
 * sidebar instead of a redirect, so the homepage is the consistent
 * starting point.
 */
export default async function Index() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect("/home");
}
