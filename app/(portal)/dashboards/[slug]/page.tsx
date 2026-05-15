import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getDashboard, userCanSeeDashboard } from "@/lib/dashboards/registry";
import { PlaceholderDashboard } from "@/components/dashboards/placeholder";
import { MarketingOverviewDashboard } from "@/components/dashboards/marketing-overview";
import { AccountPenetrationDashboard } from "@/components/dashboards/account-penetration";
import { OrdersPortalDashboard } from "@/components/dashboards/orders-portal";
import { OrdersBacklogDashboard } from "@/components/dashboards/orders-backlog";
import { OrdersReceivedDashboard } from "@/components/dashboards/orders-received";
import { RollingPipelineDashboard } from "@/components/dashboards/rolling-pipeline";
import {
  SalesPipelineDashboard,
  AccountExpansionDashboard,
  PipelineAnalyticsDashboard,
} from "@/components/dashboards/pipeline-kanban";

/**
 * Single dynamic route for every cross-customer dashboard. Looks up the
 * slug in the registry, checks the current user has permission, and renders
 * the matching component. Add new dashboards by adding an entry to the
 * registry and a case in the switch below.
 *
 * Per-customer dashboards (the customer overview) live under
 * /c/[customerId]/* and are not routed here.
 */
export default async function DashboardSlugPage(props: PageProps<"/dashboards/[slug]">) {
  const user = await requireSession();
  const { slug } = await props.params;
  const searchParams = await props.searchParams;

  const dashboard = getDashboard(slug);
  if (!dashboard) notFound();

  if (!userCanSeeDashboard(user.dashboards, slug, user.role)) {
    redirect("/");
  }

  // Wire new dashboards in here as you build their renderers. Until then,
  // they fall through to the placeholder.
  switch (dashboard.id) {
    case "marketing-overview":
      return (
        <MarketingOverviewDashboard viewerName={user.name} searchParams={searchParams} />
      );
    case "orders-portal":
      return <OrdersPortalDashboard dashboard={dashboard} />;
    case "orders-backlog":
      return <OrdersBacklogDashboard dashboard={dashboard} />;
    case "orders-received":
      return <OrdersReceivedDashboard dashboard={dashboard} />;
    case "rolling-pipeline":
      return <RollingPipelineDashboard dashboard={dashboard} />;
    case "sales-pipeline":
      return <SalesPipelineDashboard />;
    case "account-expansion":
      return <AccountExpansionDashboard />;
    case "account-penetration":
      return <AccountPenetrationDashboard />;
    case "pipeline-analytics":
      return <PipelineAnalyticsDashboard />;
    default:
      return <PlaceholderDashboard dashboard={dashboard} />;
  }
}

export async function generateMetadata(props: PageProps<"/dashboards/[slug]">) {
  const { slug } = await props.params;
  const dashboard = getDashboard(slug);
  return { title: dashboard ? `${dashboard.name} — WB Blends` : "Dashboard — WB Blends" };
}
