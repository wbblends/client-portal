import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getPipelineKanban,
  type PipelineKanban,
} from "@/lib/marketing/hubspot";
import { PipelineBoard } from "./pipeline-board";
import { PipelineAnalyticsView } from "./pipeline-analytics-view";

export async function SalesPipelineDashboard() {
  const data = await getPipelineKanban();
  const pipeline = data.pipelines.find(p => p.key === "sales");
  return (
    <SinglePipelinePage
      kicker="Sales"
      title="New Logo Pipeline"
      description="Open deals in the New Logo Pipeline, grouped by stage. Click any card to see the most recent notes from HubSpot."
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
      description="Open deals in the Wallet Share Pipeline, grouped by stage. Click any card to see the most recent notes from HubSpot."
      pipeline={pipeline}
      source={data.source}
    />
  );
}

export async function PipelineAnalyticsDashboard() {
  const data = await getPipelineKanban();

  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-muted">Sales</p>
          <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
            Pipeline Analytics
          </h1>
          <p className="mt-1 max-w-[640px] text-sm text-muted">
            Open-deal value across both HubSpot pipelines, sliced by rep, tier, format, and source.
          </p>
        </div>
        {data.source === "placeholder" && (
          <Badge tone="warning">Placeholder data — set HUBSPOT_PRIVATE_APP_TOKEN</Badge>
        )}
      </div>

      <PipelineAnalyticsView data={data} />
    </div>
  );
}

function SinglePipelinePage({
  kicker,
  title,
  description,
  pipeline,
  source,
}: {
  kicker: string;
  title: string;
  description: string;
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
          <p className="mt-1 max-w-[640px] text-sm text-muted">{description}</p>
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

