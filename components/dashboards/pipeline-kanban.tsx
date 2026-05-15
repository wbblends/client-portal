import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  getPipelineKanban,
  type PipelineKanban,
} from "@/lib/marketing/hubspot";
import { getPipelineHistory } from "@/lib/marketing/pipeline-history";
import { CumulativePipelineChart } from "@/components/dashboard/marketing-pipeline-chart";
import { PipelineBoard } from "./pipeline-board";
import { PipelineAnalyticsView } from "./pipeline-analytics-view";

export async function SalesPipelineDashboard() {
  const data = await getPipelineKanban();
  const pipeline = data.pipelines.find(p => p.key === "sales");
  return (
    <SinglePipelinePage
      kicker="Sales"
      title="New Logo Pipeline"
      pipeline={pipeline}
      source={data.source}
    />
  );
}

export async function AccountExpansionDashboard() {
  const data = await getPipelineKanban();
  const pipeline = data.pipelines.find(p => p.key === "expansion");
  return (
    <SinglePipelinePage
      kicker="Sales"
      title="Wallet Share Pipeline"
      pipeline={pipeline}
      source={data.source}
    />
  );
}

export async function PipelineAnalyticsDashboard() {
  const now = new Date();
  const [data, history] = await Promise.all([
    getPipelineKanban(),
    getPipelineHistory({
      from: new Date(now.getFullYear(), now.getMonth() - 11, 1),
      to: now,
    }),
  ]);
  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-muted">Sales</p>
          <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
            Pipeline Analytics
          </h1>
        </div>
        {data.source === "placeholder" && (
          <Badge tone="warning">Placeholder data — set HUBSPOT_PRIVATE_APP_TOKEN</Badge>
        )}
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

      <PipelineAnalyticsView data={data} />
    </div>
  );
}

function SinglePipelinePage({
  kicker,
  title,
  pipeline,
  source,
}: {
  kicker: string;
  title: string;
  pipeline: PipelineKanban | undefined;
  source: "live" | "placeholder";
}) {
  return (
    <div className="page-container page-pad-x page-pad-y flex flex-col h-dvh gap-5 sm:gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-muted">{kicker}</p>
          <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        {source === "placeholder" && (
          <Badge tone="warning">Placeholder data — set HUBSPOT_PRIVATE_APP_TOKEN</Badge>
        )}
      </div>

      {pipeline ? (
        <PipelineBoard pipeline={pipeline} fillHeight />
      ) : (
        <Card className="px-5 py-8 text-sm text-muted">No data for this pipeline.</Card>
      )}
    </div>
  );
}

