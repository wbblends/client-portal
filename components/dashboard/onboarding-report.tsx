import { Badge } from "@/components/ui/badge";
import type { OnboardingProduct, OnboardingStage } from "@/lib/data/onboarding";
import { ONBOARDING_STAGE_META, ONBOARDING_STAGE_ORDER } from "@/lib/data/onboarding";

/**
 * Onboarding Pipeline — Kanban view of every SKU we're commercializing with
 * this customer that hasn't yet hit recurring production. Columns are the
 * stages (Quoting → R&D → PH → FPS Review → Approved); cards are SKUs.
 *
 * Desktop: five columns side by side. Smaller widths fall back to a single
 * horizontally scrollable rail so columns keep a readable card width instead
 * of squeezing.
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
  const byStage = groupByStage(products);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-card)]">
      <div className="bg-primary text-primary-foreground px-5 py-3.5">
        <h3 className="font-display text-[20px] leading-tight">
          {customerName} — Onboarding Pipeline
        </h3>
      </div>
      <div className="bg-primary/15 text-primary px-5 py-1.5 text-[13px] font-semibold tracking-tight">
        Commercialization Pipeline: {reportDate}
      </div>

      <div className="overflow-x-auto bg-surface/50">
        <ol
          className="
            flex gap-3 p-3
            md:grid md:gap-3 md:p-4
            md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]
          "
          style={{ ["--cols" as string]: ONBOARDING_STAGE_ORDER.length }}
        >
          {ONBOARDING_STAGE_ORDER.map(stage => (
            <KanbanColumn
              key={stage}
              stage={stage}
              products={byStage[stage] ?? []}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  products,
}: {
  stage: OnboardingStage;
  products: OnboardingProduct[];
}) {
  const meta = ONBOARDING_STAGE_META[stage];
  return (
    <li className="flex w-[78vw] max-w-[300px] flex-col md:w-auto md:max-w-none">
      <div className="rounded-t-lg border border-b-0 border-border bg-card px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={meta.tone}>{stage}</Badge>
          <span className="tabular-nums text-[11px] font-semibold text-muted">
            {products.length}
          </span>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-snug text-muted">
          {meta.description}
        </p>
      </div>

      <ul className="flex-1 space-y-2 rounded-b-lg border border-t-0 border-border bg-accent/30 p-2 min-h-[120px]">
        {products.length === 0 ? (
          <li className="px-2 py-3 text-[12px] text-muted">No SKUs in this stage.</li>
        ) : (
          products.map(p => <KanbanCard key={p.id} product={p} />)
        )}
      </ul>
    </li>
  );
}

function KanbanCard({ product: p }: { product: OnboardingProduct }) {
  return (
    <li className="rounded-md border border-border bg-card p-3 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] text-muted">{p.sku}</span>
        <span className="tabular-nums text-[10.5px] text-muted">{p.lastUpdated}</span>
      </div>
      <h4 className="mt-1 text-[13.5px] font-semibold leading-snug text-foreground">
        {p.productName}
      </h4>
      <div className="mt-0.5 text-[11.5px] text-muted">
        {p.format} · {p.count}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-foreground-soft">
        {p.lastNote}
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px]">
        <span className="text-muted">Owner</span>
        <span className="font-medium text-foreground-soft">{p.owner}</span>
      </div>
    </li>
  );
}

function groupByStage(
  products: OnboardingProduct[],
): Record<OnboardingStage, OnboardingProduct[]> {
  const out = {
    Quoting: [],
    "R&D": [],
    PH: [],
    "FPS Review": [],
    Approved: [],
  } as Record<OnboardingStage, OnboardingProduct[]>;
  for (const p of products) out[p.stage].push(p);
  return out;
}
