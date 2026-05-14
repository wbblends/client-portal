import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getAccountPenetration, type AccountPenetration } from "@/lib/marketing/hubspot";

/**
 * Account Penetration dashboard. Server component.
 *
 * One progress bar per account. The bar's full width is the account's initial
 * projection — the value closed in the Sales Pipeline. The solid fill is
 * wallet share we've since CLOSED WON; the lighter fill is wallet share still
 * IN PROGRESS (quoting / formulation / onboarding). Both fills are capped at
 * the projection; anything beyond shows as an "over projection" badge.
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
          <p className="mt-1 max-w-[640px] text-sm text-muted">
            How far we&apos;ve penetrated each account. The bar is the initial projection —
            the value closed in the Sales Pipeline — and fills with wallet share won, then
            wallet share still in progress.
          </p>
        </div>
        {data.source === "placeholder" && (
          <Badge tone="warning">Placeholder data — set HUBSPOT_PRIVATE_APP_TOKEN</Badge>
        )}
      </div>

      <Legend />

      <div className="space-y-4">
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
      <LegendDot className="bg-primary" label="Wallet share won" />
      <LegendDot
        className="bg-primary/30"
        label="Wallet share in progress (quoting / R&D / onboarding)"
      />
      <LegendDot className="bg-accent" label="Untapped vs. projection" />
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
  const overflow = Math.max(totalIdentified - projection, 0);
  const untapped = Math.max(projection - totalIdentified, 0);
  const capturedPct = hasProjection ? Math.round((account.captured / projection) * 100) : 0;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <h2 className="font-display text-[20px] leading-tight tracking-tight text-foreground">
            {account.name}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Initial projection{" "}
            <span className="font-medium tabular-nums text-foreground-soft">
              {hasProjection ? formatCurrency(projection, { compact: true }) : "—"}
            </span>
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
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[28px] font-semibold tabular-nums tracking-tight text-foreground">
              {capturedPct}%
            </span>
            <span className="text-sm text-muted">of projection captured</span>
          </div>

          <div
            className="relative mt-2 h-3.5 w-full overflow-hidden rounded-full bg-accent"
            role="img"
            aria-label={`${capturedPct}% of the ${formatCurrency(projection, {
              compact: true,
            })} projection captured, with ${formatCurrency(account.inProgress, {
              compact: true,
            })} in progress`}
          >
            {/* In-progress segment: spans the full filled width, lighter shade. */}
            <div
              className="absolute inset-y-0 left-0 bg-primary/30"
              style={{ width: `${filledFrac * 100}%` }}
            />
            {/* Captured segment: solid, drawn on top from the left edge. */}
            <div
              className="absolute inset-y-0 left-0 bg-primary"
              style={{ width: `${capturedFrac * 100}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            <Stat dotClass="bg-primary" label="Captured">
              {formatCurrency(account.captured, { compact: true })}
              <span className="font-normal text-muted">
                {" · "}
                {formatNumber(account.capturedDealCount)} won
              </span>
            </Stat>
            <Stat dotClass="bg-primary/30" label="In progress">
              {formatCurrency(account.inProgress, { compact: true })}
              <span className="font-normal text-muted">
                {" · "}
                {formatNumber(account.inProgressDealCount)} deals
              </span>
            </Stat>
            <Stat dotClass="bg-accent" label="Untapped">
              {formatCurrency(untapped, { compact: true })}
            </Stat>
            {overflow > 0 && (
              <Badge tone="success" className="ml-auto">
                +{formatCurrency(overflow, { compact: true })} over projection
              </Badge>
            )}
          </div>
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

function Stat({
  dotClass,
  label,
  children,
}: {
  dotClass: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      <span className="text-muted">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{children}</span>
    </span>
  );
}
