import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { PipelineFlowChart } from "@/components/dashboard/marketing-pipeline-chart";
import {
  PaidVisitsTrendChart,
  TrafficShareChart,
  EngagementCompareChart,
} from "@/components/dashboard/ad-analytics-charts";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  getPipelineSummary,
  getMarketingAttribution,
  getTypeformLeadCountsForRange,
} from "@/lib/marketing/hubspot";
import { getMarketingInfluencedPOs } from "@/lib/marketing/orders";
import { getPipelineHistory } from "@/lib/marketing/pipeline-history";
import {
  getAdAnalytics,
  type NetworkMetrics,
  type AdAnalyticsSummary,
} from "@/lib/marketing/hubspot-analytics";
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
  const adAnalytics = await getAdAnalytics(
    { from: range.from, to: range.to },
    { from: compare.from, to: compare.to },
  );

  const leadDelta = pctChange(leadCounts.inRange, leadCounts.inCompareRange);

  return (
    <div className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted">Welcome back, {viewerName.split(" ")[0]}.</p>
          <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
            Marketing Overview
          </h1>
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

      {/* Pipeline flow (range-scoped chart) */}
      <section className="space-y-3">
        <SectionHeader
          title="Pipeline flow"
          description="Reconstructed from current deals + their create / close dates. Deals added vs closed-won / closed-lost during each bucket."
          source={history.source}
        />
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

      {/* Paid traffic & engagement (Google Ads + LinkedIn Ads) */}
      <section className="space-y-3">
        <SectionHeader
          title="Paid traffic & engagement"
          description="Post-click analytics from HubSpot's traffic-sources report. Visits = ad clicks that landed on the site (Google = paid search, LinkedIn = paid social). Impressions / CTR / ad spend aren't exposed by HubSpot's public API — those live in Google Ads & LinkedIn Campaign Manager."
          source={adAnalytics.source}
        />
        <AdAnalyticsKpis analytics={adAnalytics} compareLabel={compare.shortLabel} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <NetworkCard metrics={adAnalytics.byNetwork[0]} accent="google" />
          <NetworkCard metrics={adAnalytics.byNetwork[1]} accent="linkedin" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Daily paid visits</CardTitle>
            <CardDescription>
              Stacked daily series — Google Ads (paid search) and LinkedIn Ads (paid social) over
              the selected range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaidVisitsTrendChart points={adAnalytics.daily} />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Traffic source share</CardTitle>
              <CardDescription>
                Every traffic source in the range. Paid slices highlighted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrafficShareChart slices={adAnalytics.trafficShare} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Engagement quality by network</CardTitle>
              <CardDescription>
                Lower bounce + higher pages/session = better post-click experience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EngagementCompareChart networks={adAnalytics.byNetwork} />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function AdAnalyticsKpis({
  analytics,
  compareLabel,
}: {
  analytics: AdAnalyticsSummary;
  compareLabel: string;
}) {
  const c = analytics.combined;
  const prev = analytics.combinedCompare;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiTile
        label="Paid visits"
        value={formatNumber(c.visits)}
        delta={pctChange(c.visits, prev.visits)}
        hint={`vs ${formatNumber(prev.visits)} ${compareLabel.toLowerCase()}`}
      />
      <KpiTile
        label="Pages / session"
        value={c.pageviewsPerSession.toFixed(2)}
        delta={pctChange(c.pageviewsPerSession, prev.pageviewsPerSession)}
        hint="Higher = deeper engagement"
      />
      <KpiTile
        label="Bounce rate"
        value={`${(c.bounceRate * 100).toFixed(1)}%`}
        delta={pctChange(c.bounceRate, prev.bounceRate)}
        preferDirection="down"
        hint="Lower = better landing fit"
      />
      <KpiTile
        label="Avg time on site"
        value={`${c.timePerSession.toFixed(0)}s`}
        delta={pctChange(c.timePerSession, prev.timePerSession)}
        hint={`${formatNumber(c.contacts)} new contacts from paid`}
      />
    </div>
  );
}

function NetworkCard({
  metrics,
  accent,
}: {
  metrics: NetworkMetrics;
  accent: "google" | "linkedin";
}) {
  const isLinkedIn = accent === "linkedin";
  const dotClass = isLinkedIn ? "bg-[#0a66c2]" : "bg-primary";
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="inline-flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
            {isLinkedIn ? "LinkedIn Ads" : "Google Ads"}
          </CardTitle>
          <span className="text-xs text-muted tabular-nums">
            <span className="text-foreground-soft font-medium">
              {formatNumber(metrics.visitors)}
            </span>{" "}
            unique visitors
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NetworkStat label="Visits" value={formatNumber(metrics.visits)} />
          <NetworkStat label="Pageviews" value={formatNumber(metrics.pageviews)} />
          <NetworkStat
            label="Bounce"
            value={`${(metrics.bounceRate * 100).toFixed(1)}%`}
          />
          <NetworkStat
            label="Time / session"
            value={`${metrics.timePerSession.toFixed(0)}s`}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border pt-3">
          <NetworkStat
            label="Pages / session"
            value={metrics.pageviewsPerSession.toFixed(2)}
          />
          <NetworkStat
            label="New visitor %"
            value={`${(metrics.newVisitorSessionRate * 100).toFixed(0)}%`}
          />
          <NetworkStat label="Contacts" value={formatNumber(metrics.contacts)} />
          <NetworkStat
            label="Visit ÷ visitor"
            value={
              metrics.visitors > 0
                ? (metrics.visits / metrics.visitors).toFixed(2)
                : "—"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function NetworkStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-display text-[18px] tabular-nums tracking-tight text-foreground">
        {value}
      </div>
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
            <dd className="mt-1 font-display text-[24px] tabular-nums tracking-tight text-foreground">
              {formatCurrency(totals.unweighted, { compact: true })}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Weighted
            </dt>
            <dd className="mt-1 font-display text-[24px] tabular-nums tracking-tight text-foreground-soft">
              {formatCurrency(totals.weighted, { compact: true })}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

