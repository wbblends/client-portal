import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import {
  CumulativePipelineChart,
  PipelineFlowChart,
} from "@/components/dashboard/marketing-pipeline-chart";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import {
  getPipelineSummary,
  getMarketingAttribution,
  getTypeformLeadCountsForRange,
} from "@/lib/marketing/hubspot";
import { getMarketingInfluencedPOs } from "@/lib/marketing/orders";
import { getPipelineHistory } from "@/lib/marketing/pipeline-history";
import { getGoogleAdSpend } from "@/lib/marketing/google-ads";
import { getLinkedInAdSpend } from "@/lib/marketing/linkedin-ads";
import { resolveRange, getCompareRange } from "@/lib/data/range";
import { pctChange } from "@/lib/data/aggregate";

/**
 * Marketing dashboard renderer. Server component.
 *
 * Pipeline KPIs at the top stay as a "current snapshot" pulse-check; everything
 * below (inbound leads, the trend chart, attributed POs, ad spend) follows the
 * date picker. Marketing-attribution pipeline value also stays as a current
 * snapshot since it mirrors the top section.
 */
export async function MarketingOverviewDashboard({
  viewerName,
  searchParams,
}: {
  viewerName: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const range = resolveRange(searchParams);
  const compare = getCompareRange(range);

  // HubSpot calls run sequentially under a shared throttle (see searchFetch
  // in lib/marketing/hubspot.ts) to stay under the CRM search API's per-second
  // rate limit. Ad-spend fetchers are placeholder-only and run in parallel after.
  const pipelines = await getPipelineSummary();
  const leadCounts = await getTypeformLeadCountsForRange(range, compare);
  const attribution = await getMarketingAttribution();
  const history = await getPipelineHistory(range);
  const influencedPOs = getMarketingInfluencedPOs(attribution.touchedCompanyNames, {
    isPlaceholder: attribution.source === "placeholder",
    range: { from: range.from, to: range.to },
  });
  const [googleAds, linkedInAds] = await Promise.all([
    getGoogleAdSpend(),
    getLinkedInAdSpend(),
  ]);

  const leadDelta = pctChange(leadCounts.inRange, leadCounts.inCompareRange);

  return (
    <div className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted">Welcome back, {viewerName.split(" ")[0]}.</p>
          <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
            Marketing Overview
          </h1>
          <p className="mt-1 text-sm text-muted">
            Showing{" "}
            <span className="text-foreground-soft font-medium">
              {formatDate(range.from, "short")} – {formatDate(range.to, "short")}
            </span>
            . Pipeline KPIs always reflect the current snapshot.
          </p>
        </div>
        <DateRangePicker from={range.from} to={range.to} presetId={range.presetId} />
      </div>

      {/* Pipeline (current snapshot — not range-scoped) */}
      <section className="space-y-3">
        <SectionHeader
          title="HubSpot pipeline value"
          description="Open deals as of right now. Weighted = amount × stage probability (HubSpot's hs_projected_amount)."
          source={pipelines.source}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <PipelineCard
            title={pipelines.perPipeline.sales.label}
            totals={pipelines.perPipeline.sales}
          />
          <PipelineCard
            title={pipelines.perPipeline.expansion.label}
            totals={pipelines.perPipeline.expansion}
          />
          <PipelineCard title="Combined" totals={pipelines.combined} accent />
        </div>
      </section>

      {/* Pipeline trend (range-scoped chart) */}
      <section className="space-y-3">
        <SectionHeader
          title="Pipeline trend"
          description="Reconstructed from current deals + their create / close dates. Top: open pipeline value at the end of each bucket. Bottom: deals added vs closed-won/lost during each bucket."
          source={history.source}
        />
        <Card>
          <CardHeader>
            <CardTitle>Cumulative open pipeline</CardTitle>
            <CardDescription>
              {history.bucketing === "week" ? "Weekly" : "Monthly"} buckets across the selected
              range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CumulativePipelineChart buckets={history.buckets} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pipeline flow</CardTitle>
            <CardDescription>
              Deals added (above zero) vs closed-won + closed-lost (below zero) per bucket.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineFlowChart buckets={history.buckets} />
          </CardContent>
        </Card>
      </section>

      {/* Inbound leads */}
      <section className="space-y-3">
        <SectionHeader
          title="Inbound leads"
          description="Typeform submissions counted from HubSpot contacts (typeform_response_type)."
          source={leadCounts.source}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiTile
            label="In selected range"
            value={formatNumber(leadCounts.inRange)}
            delta={leadDelta}
            hint={`vs ${formatNumber(leadCounts.inCompareRange)} ${compare.shortLabel.toLowerCase()}`}
          />
          <KpiTile
            label={compare.label}
            value={formatNumber(leadCounts.inCompareRange)}
          />
          <KpiTile
            label="All time"
            value={formatNumber(leadCounts.allTime)}
          />
        </div>
      </section>

      {/* Marketing attribution */}
      <section className="space-y-3">
        <SectionHeader
          title="Marketing attribution"
          description="Open deals + POs in range, from companies whose contacts came in via Typeform. Pipeline counts every open deal on a company that has at least one Typeform-tagged contact in HubSpot."
          source={
            attribution.source === "placeholder" || influencedPOs.source === "placeholder"
              ? "placeholder"
              : undefined
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            label="Attributed pipeline (unweighted)"
            value={formatCurrency(attribution.attributedUnweighted, { compact: true })}
            hint={`${formatNumber(attribution.attributedDealCount)} open deals · ${formatNumber(
              attribution.touchedCompanyNames.length,
            )} companies`}
          />
          <KpiTile
            label="Attributed pipeline (weighted)"
            value={formatCurrency(attribution.attributedWeighted, { compact: true })}
          />
          <KpiTile
            label="Marketing-influenced POs in range"
            value={formatCurrency(influencedPOs.ytdInfluencedPOs, { compact: true })}
            hint={`${formatNumber(influencedPOs.matches.length)} matched customers`}
          />
          <KpiTile
            label="Share of POs in range"
            value={`${(influencedPOs.influencedShare * 100).toFixed(1)}%`}
            hint={`of ${formatCurrency(influencedPOs.totalYTDPOs, { compact: true })} total`}
            preferDirection="up"
          />
        </div>

        {influencedPOs.matches.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Matched customers</CardTitle>
              <CardDescription>
                HubSpot companies (with Typeform-touched contacts) that also appear in the orders
                portal. Sorted by PO value in the selected range.
              </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted border-y border-border bg-surface/60">
                    <th className="px-5 py-2.5 font-semibold">Customer</th>
                    <th className="px-3 py-2.5 font-semibold">HubSpot match</th>
                    <th className="px-5 py-2.5 text-right font-semibold">POs in range</th>
                  </tr>
                </thead>
                <tbody>
                  {influencedPOs.matches.slice(0, 15).map((m, idx) => (
                    <tr
                      key={m.ordersCustomer}
                      className={`border-b border-border last:border-b-0 ${
                        idx % 2 === 1 ? "bg-surface/30" : ""
                      }`}
                    >
                      <td className="px-5 py-2.5 text-foreground">{m.ordersCustomer}</td>
                      <td className="px-3 py-2.5 text-muted">{m.hubspotCompany}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-medium text-foreground">
                        {formatCurrency(m.ytdPOs, { compact: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {influencedPOs.unmatchedHubSpotCompanies.length > 0 && (
              <details className="px-5 py-3 border-t border-border text-xs text-muted">
                <summary className="cursor-pointer hover:text-foreground select-none">
                  {formatNumber(influencedPOs.unmatchedHubSpotCompanies.length)} HubSpot companies
                  not matched in orders portal
                </summary>
                <p className="mt-2 leading-relaxed">
                  {influencedPOs.unmatchedHubSpotCompanies.join(", ")}
                </p>
              </details>
            )}
          </Card>
        )}
      </section>

      {/* Ad spend */}
      <section className="space-y-3">
        <SectionHeader title="Ad spend" description="Paid media across Google and LinkedIn." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AdSpendCard title="Google Ads" stats={googleAds} />
          <AdSpendCard title="LinkedIn Ads" stats={linkedInAds} />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  source,
}: {
  title: string;
  description: string;
  source?: "live" | "placeholder";
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-[24px] leading-tight tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted mt-1 max-w-[820px]">{description}</p>
      </div>
      {source === "placeholder" && (
        <Badge tone="warning" className="shrink-0 mt-1">
          Demo data
        </Badge>
      )}
    </div>
  );
}

function PipelineCard({
  title,
  totals,
  accent,
}: {
  title: string;
  totals: { unweighted: number; weighted: number; dealCount: number };
  accent?: boolean;
}) {
  // The Combined card is the primary; render it on a faint primary wash so it
  // pulls the eye without yelling.
  const cardClass = accent
    ? "border-primary/25 bg-gradient-to-br from-primary-soft/60 to-card"
    : undefined;
  return (
    <Card className={cardClass}>
      <CardHeader className="pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="inline-flex items-center gap-2">
            {accent && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
            {title}
          </CardTitle>
          <span className="text-xs text-muted tabular-nums">
            <span className="text-foreground-soft font-medium">{totals.dealCount}</span> open
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Unweighted
            </dt>
            <dd className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight text-foreground">
              {formatCurrency(totals.unweighted, { compact: true })}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Weighted
            </dt>
            <dd className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight text-foreground-soft">
              {formatCurrency(totals.weighted, { compact: true })}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function AdSpendCard({
  title,
  stats,
}: {
  title: string;
  stats: { source: "live" | "placeholder"; last7d: number; last30d: number; mtd: number };
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>Paid media spend</CardDescription>
          </div>
          {stats.source === "placeholder" && (
            <Badge tone="warning" className="shrink-0">
              Demo data
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 divide-x divide-border">
          <AdSpendStat label="Last 7d" value={stats.last7d} />
          <AdSpendStat label="Last 30d" value={stats.last30d} />
          <AdSpendStat label="MTD" value={stats.mtd} last />
        </div>
      </CardContent>
    </Card>
  );
}

function AdSpendStat({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <div className={last ? "pl-4" : "pr-4 first:pl-0"}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums tracking-tight text-foreground">
        {formatCurrency(value, { compact: true })}
      </div>
    </div>
  );
}
