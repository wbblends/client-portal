import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { BrandResearcher } from "./brand-researcher";

/**
 * Brand Researcher — lives under the portal's Tools section, available to
 * every signed-in user (the (portal) layout already gates auth). A rep names a
 * brand, confirms we've got the right company, and the tool runs deep web
 * research: revenue & estimated manufacturing spend, likely co-packers, key
 * people on LinkedIn, news/funding, and a recommended outreach approach.
 */
export const metadata: Metadata = {
  title: "Brand Researcher — WB Blends",
  description:
    "Deep-research a prospective brand: revenue, manufacturing, key people, and a way in.",
};

export default async function BrandResearcherPage() {
  const user = await requireSession();
  // Customers (external portal logins) must not see internal HubSpot CRM data.
  return <BrandResearcher canSeeCrm={user.role !== "customer"} />;
}
