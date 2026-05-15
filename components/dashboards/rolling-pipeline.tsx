import type { Dashboard } from "@/lib/dashboards/registry";
import { requireSession } from "@/lib/auth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { getPipelineHistory } from "@/lib/marketing/pipeline-history";
import { CumulativePipelineChart } from "@/components/dashboard/marketing-pipeline-chart";

export async function RollingPipelineDashboard({
  dashboard,
}: {
  dashboard: Dashboard;
}) {
  await requireSession();
  const now = new Date();
  const history = await getPipelineHistory({
    from: new Date(now.getFullYear(), now.getMonth() - 11, 1),
    to: now,
  });

  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-7">
      <div>
        <p className="text-sm text-muted">{dashboard.category}</p>
        <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
          {dashboard.name}
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cumulative open pipeline</CardTitle>
          <CardDescription>
            Total open pipeline value at each month-end over the last 12 months, stacked by
            pipeline — New Logo + Wallet Share.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CumulativePipelineChart buckets={history.buckets} />
        </CardContent>
      </Card>
    </div>
  );
}
