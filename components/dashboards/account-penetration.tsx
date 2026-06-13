import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { getAccountPenetration, type AccountPenetration } from "@/lib/marketing/hubspot";

/**
 * Account Penetration dashboard. Server component.
 *
 * One progress bar per account. The bar's full width is the account's initial
 * projection — the value closed in the Sales Pipeline. GREEN is wallet share
 * we've CLOSED WON; YELLOW is wallet share still IN PROGRESS (quoting /
 * formulation / onboarding); RED is the UNTAPPED remainder we're not yet
 * working. Both fills are capped at the projection; anything beyond shows as
 * an "over projection" badge.
 */
export async function AccountPenetrationDashboard() {
  const data = await getAccountPenetration();

  return (
    <div className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-muted">Sales</p>
          <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
            Account Penetration
          </h1>
        </div>
        {data.source === "placeholder" && (
          <Badge tone="warning">Placeholder data — set HUBSPOT_PRIVATE_APP_TOKEN</Badge>
        )}
      </div>

      <Legend />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.accounts.map(account => (
          <AccountCard key={account.companyId} account={account} />
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
      <LegendDot className="bg-success" label="Closed won" />
      <LegendDot
        className="bg-warning"
        label="In progress (quoting / R&D / onboarding)"
      />
      <LegendDot className="bg-danger" label="Untapped / not working" />
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} aria-hidden />
      {label}
    </span>
  );
}

function AccountCard({ account }: { account: AccountPenetration }) {
  const projection = Math.max(account.projection, 0);
  const hasProjection = projection > 0;

  // Cap both fills at the projection. The solid (captured) segment is anchored
  // left; the lighter (in-progress) segment fills whatever room is left after
  // it. Anything past the projection is surfaced as an overflow badge instead
  // of stretching the bar, so bars stay comparable across accounts.
  const capturedFrac = hasProjection ? Math.min(account.captured / projection, 1) : 0;
  const inProgressRoom = Math.max(1 - capturedFrac, 0);
  const inProgressFrac = hasProjection
    ? Math.min(account.inProgress / projection, inProgressRoom)
    : 0;
  const filledFrac = capturedFrac + inProgressFrac;

  const totalIdentified = account.captured + account.inProgress;
  const untapped = Math.max(projection - totalIdentified, 0);

  // Percentages are the true ratio to the projection, NOT the capped bar
  // width — so an account whose pipeline has outgrown its projection reads
  // above 100% even though its bar segment is clipped at the projection.
  const pctOfProjection = (value: number) =>
    hasProjection ? Math.round((value / projection) * 100) : 0;
  const capturedPct = pctOfProjection(account.captured);
  const inProgressPct = pctOfProjection(account.inProgress);
  const untappedPct = pctOfProjection(untapped);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <h2 className="font-display text-[20px] leading-tight tracking-tight text-foreground">
            {account.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {account.firstNewLogoCloseDate
              ? `First closed in New Logo Pipeline · ${formatDate(account.firstNewLogoCloseDate)}`
              : "No closed-won deal in New Logo Pipeline"}
          </p>
        </div>
        <a
          href={account.hubspotUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-medium text-muted hover:text-foreground"
        >
          View in HubSpot ↗
        </a>
      </div>

      {hasProjection ? (
        <>
          {/* Header: annual revenue captured is the hero, framed in dollars
              against the initial projection. */}
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
              Annual Revenue Captured
            </p>
            <p className="mt-1 font-display text-[36px] leading-none tabular-nums tracking-tight text-foreground">
              {formatCurrency(account.captured, { compact: true })}
            </p>
            <p className="mt-1.5 text-xs tabular-nums text-muted">
              of {formatCurrency(projection, { compact: true })} initially projected ·{" "}
              {capturedPct}% · {formatNumber(account.capturedDealCount)} won
            </p>
          </div>

          <div
            className="relative mt-4 h-3.5 w-full overflow-hidden rounded-full bg-danger"
            role="img"
            aria-label={`${formatCurrency(account.captured, {
              compact: true,
            })} of the ${formatCurrency(projection, {
              compact: true,
            })} projection closed won (green), with another ${formatCurrency(account.inProgress, {
              compact: true,
            })} in progress (yellow); the remainder is untapped (red)`}
          >
            {/* In-progress (yellow): spans the full filled width. */}
            <div
              className="absolute inset-y-0 left-0 bg-warning"
              style={{ width: `${filledFrac * 100}%` }}
            />
            {/* Closed won (green): solid, drawn on top from the left edge. */}
            <div
              className="absolute inset-y-0 left-0 bg-success"
              style={{ width: `${capturedFrac * 100}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            <PenetrationStat
              dotClass="bg-warning"
              label="In progress"
              pct={inProgressPct}
              detail={`${formatCurrency(account.inProgress, { compact: true })} · ${formatNumber(
                account.inProgressDealCount,
              )} deals`}
            />
            <PenetrationStat
              dotClass="bg-danger"
              label="Untapped"
              pct={untappedPct}
              detail={formatCurrency(untapped, { compact: true })}
            />
          </div>

          {account.capturedDeals.length > 0 && <WonDealsTable account={account} />}
        </>
      ) : (
        <p className="mt-4 text-sm text-muted">
          No closed-won deal in the Sales Pipeline for this account, so there&apos;s no
          projection to measure against yet.
          {(account.captured > 0 || account.inProgress > 0) && (
            <>
              {" "}
              Wallet share so far: {formatCurrency(account.captured, { compact: true })} won,{" "}
              {formatCurrency(account.inProgress, { compact: true })} in progress.
            </>
          )}
        </p>
      )}
    </Card>
  );
}

function PenetrationStat({
  dotClass,
  label,
  pct,
  detail,
}: {
  dotClass: string;
  label: string;
  pct: number;
  detail: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-sm text-muted">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        {label}
      </div>
      <div className="mt-1 font-display text-[22px] leading-none tabular-nums tracking-tight text-foreground">
        {pct}%
      </div>
      <div className="mt-1.5 text-xs tabular-nums text-muted">{detail}</div>
    </div>
  );
}

function WonDealsTable({ account }: { account: AccountPenetration }) {
  const largest = account.capturedDeals[0];
  return (
    <details className="group mt-4">
      <summary className="flex cursor-pointer select-none list-none items-baseline gap-2 text-sm text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="inline-block text-xs leading-none transition-transform group-open:rotate-90"
        >
          ›
        </span>
        <span className="font-medium text-foreground">
          Won deals · {formatNumber(account.capturedDealCount)}
        </span>
        <span className="hidden truncate sm:inline">
          · Largest {largest.name} {formatCurrency(largest.amount, { compact: true })}
        </span>
      </summary>
      <div className="mt-3 overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-accent/40 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Product Won</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {account.capturedDeals.map(deal => (
              <tr key={deal.id} className="hover:bg-accent/30">
                <td className="px-3 py-2">
                  <a
                    href={deal.hubspotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:underline"
                  >
                    {deal.name}
                  </a>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {formatCurrency(deal.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
