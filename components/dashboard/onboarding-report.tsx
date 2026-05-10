import { Badge } from "@/components/ui/badge";
import type { OnboardingProduct } from "@/lib/data/onboarding";
import { ONBOARDING_STAGE_META } from "@/lib/data/onboarding";

/**
 * Onboarding Products Report — every SKU we're working through with this
 * customer that hasn't yet hit recurring production. Same banner treatment
 * as the open-orders report so the two read as a family.
 *
 * Mobile: collapses to a card stack so the long Last Note doesn't blow up
 * row heights when the table overflows horizontally.
 */
export function OnboardingReport({
  products,
  reportDate,
  customerName,
}: {
  products: OnboardingProduct[];
  reportDate: string;
  customerName: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-card)]">
      <div className="bg-primary text-primary-foreground px-5 py-4">
        <h3 className="font-display text-2xl leading-tight">
          {customerName} — Onboarding Statuses
        </h3>
      </div>
      <div className="bg-primary/15 text-primary px-5 py-2 text-sm font-bold tracking-tight">
        Commercialization Pipeline: {reportDate}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-base border-collapse">
          <thead className="text-left text-xs font-bold uppercase tracking-wide text-muted">
            <tr className="border-b-2 border-border-strong">
              <th className="px-4 py-3">SKU</th>
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">Format</th>
              <th className="px-3 py-3">Stage</th>
              <th className="px-3 py-3">Owner</th>
              <th className="px-3 py-3 whitespace-nowrap">Last Update</th>
              <th className="px-4 py-3">Last Note</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const meta = ONBOARDING_STAGE_META[p.stage];
              return (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-b-0 align-top hover:bg-accent/40 transition-colors"
                >
                  <td className="px-4 py-4 font-mono text-sm text-foreground-soft whitespace-nowrap">
                    {p.sku}
                  </td>
                  <td className="px-3 py-4 font-semibold text-foreground min-w-[180px]">
                    {p.productName}
                    <div className="text-sm font-normal text-muted mt-1">{p.count}</div>
                  </td>
                  <td className="px-3 py-4 text-foreground-soft whitespace-nowrap">{p.format}</td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <Badge tone={meta.tone}>{p.stage}</Badge>
                  </td>
                  <td className="px-3 py-4 text-foreground-soft whitespace-nowrap">{p.owner}</td>
                  <td className="px-3 py-4 text-muted whitespace-nowrap tabular-nums">
                    {p.lastUpdated}
                  </td>
                  <td className="px-4 py-4 max-w-[440px] text-base text-foreground-soft leading-relaxed">
                    {p.lastNote}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card stack */}
      <ul className="md:hidden divide-y divide-border">
        {products.map(p => {
          const meta = ONBOARDING_STAGE_META[p.stage];
          return (
            <li key={p.id} className="p-5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge tone={meta.tone}>{p.stage}</Badge>
                <span className="font-mono text-sm text-muted">{p.sku}</span>
              </div>
              <h4 className="mt-2 text-base font-bold text-foreground leading-snug">
                {p.productName}
              </h4>
              <div className="text-sm text-muted mt-1">
                {p.format} · {p.count}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-muted flex-wrap gap-2">
                <span>Owner: <span className="text-foreground-soft font-semibold">{p.owner}</span></span>
                <span className="tabular-nums">Updated {p.lastUpdated}</span>
              </div>
              <p className="mt-3 text-base text-foreground-soft leading-relaxed">{p.lastNote}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
