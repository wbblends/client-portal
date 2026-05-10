import { requireSession } from "@/lib/auth";
import { getAccountPenetration } from "@/lib/data/account-penetration";
import { getSalesAndExpansionPipelines } from "@/lib/hubspot/pipelines";
import { AccountPenetrationThermometer } from "@/components/sales/account-penetration-thermometer";
import { AccountExpansionSkus } from "@/components/sales/account-expansion-skus";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Account Penetration — WB Blends" };

// Refresh from HubSpot every 5 minutes for the routine sync.
export const revalidate = 300;

export default async function AccountPenetrationPage() {
  await requireSession();
  const [summary, pipelines] = await Promise.all([
    getAccountPenetration(),
    getSalesAndExpansionPipelines(),
  ]);

  const planPct =
    summary.totals.expectedAnnualValue > 0
      ? (summary.totals.filledValue / summary.totals.expectedAnnualValue) * 100
      : 0;

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto space-y-7">
      {/* Page header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted">Sales · Executive view</p>
          <h1 className="mt-0.5 font-display text-[34px] leading-[1.1] tracking-tight text-foreground">
            Account Penetration
          </h1>
          <p className="mt-1 text-sm text-muted max-w-2xl">
            For each closed-won account, the bar width is the projected annual
            run-rate at close. Solid purple is what&apos;s already shipping (closed-won
            on the Account Expansion pipeline). Lighter bands are deals still
            moving through Onboarding, Quoting, and R&amp;D.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted leading-tight">Synced from HubSpot</div>
          <div className="text-sm text-foreground-soft tabular-nums">
            as of {formatDate(summary.asOf, "medium")}
          </div>
          {summary.usingMockData ? (
            <div className="mt-1 text-[11px] text-warning bg-warning-soft inline-block px-2 py-0.5 rounded">
              Mock data — set HUBSPOT_PRIVATE_APP_TOKEN to sync live
            </div>
          ) : null}
        </div>
      </div>

      {/* Roll-up KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Total expected annual"
          value={formatCurrency(summary.totals.expectedAnnualValue, { compact: true })}
          hint={`across ${summary.accounts.length} closed accounts`}
        />
        <KpiTile
          label="Already shipping"
          value={formatCurrency(summary.totals.filledValue, { compact: true })}
          hint={`${planPct.toFixed(0)}% of plan`}
          preferDirection="up"
        />
        <KpiTile
          label="In flight"
          value={formatCurrency(summary.totals.inFlightValue, { compact: true })}
          hint="onboarding + quoting + R&D"
        />
        <KpiTile
          label="White space"
          value={formatCurrency(summary.totals.whiteSpaceValue, { compact: true })}
          hint="capacity below plan, no deal yet"
        />
      </div>

      {/* Per-account thermometers */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-[24px] leading-tight tracking-tight text-foreground">
            Accounts
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Sorted by expected annual value, largest first.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {summary.accounts.map(row => (
            <AccountPenetrationThermometer key={row.companyId} row={row}>
              <AccountExpansionSkus
                deals={row.expansionDeals}
                pipeline={pipelines.expansion}
              />
            </AccountPenetrationThermometer>
          ))}
        </div>
      </section>
    </div>
  );
}
