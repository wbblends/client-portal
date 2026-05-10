import { Badge } from "@/components/ui/badge";
import type { OnboardingProduct } from "@/lib/data/onboarding";
import { ONBOARDING_STAGE_META } from "@/lib/data/onboarding";
import { formatCurrency, formatNumber } from "@/lib/utils";

/**
 * Detail panel rendered inside a Popover when a row in the Onboarding report
 * is clicked. Shows the same key facts the table renders, plus formulation
 * summary, stage history, documents, and recent activity.
 */
export function OnboardingDetailCard({ product }: { product: OnboardingProduct }) {
  const meta = ONBOARDING_STAGE_META[product.stage];

  return (
    <div className="flex flex-col max-h-[520px]">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span className="font-mono">{product.sku}</span>
              <span>·</span>
              <span>{product.format} · {product.count}</span>
            </div>
            <h3 className="mt-1 font-display text-[18px] leading-tight text-foreground truncate">
              {product.productName}
            </h3>
          </div>
          <Badge tone={meta.tone}>{product.stage}</Badge>
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted">{meta.description}</p>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto px-5 py-4 space-y-4">
        {/* Key facts */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px]">
          <Field label="Owner" value={product.owner} />
          <Field label="Last update" value={product.lastUpdated} mono />
          {product.targetLaunchDate && (
            <Field label="Target launch" value={product.targetLaunchDate} />
          )}
          {product.pricePerUnit !== undefined && (
            <Field label="Price / unit" value={formatCurrency(product.pricePerUnit)} mono />
          )}
          {product.minimumOrderQuantity !== undefined && (
            <Field label="MOQ" value={formatNumber(product.minimumOrderQuantity)} mono />
          )}
        </dl>

        {/* Formulation */}
        {product.formulationSummary && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1">
              Formulation
            </div>
            <p className="text-[12.5px] text-foreground-soft leading-snug">
              {product.formulationSummary}
            </p>
          </div>
        )}

        {/* Last note */}
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1">
            Last note
          </div>
          <p className="text-[13px] text-foreground-soft leading-snug">{product.lastNote}</p>
        </div>

        {/* Stage history */}
        {product.stageHistory && product.stageHistory.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-2">
              Stage history
            </div>
            <ol className="space-y-1.5">
              {product.stageHistory.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px]">
                  <span
                    className={
                      "mt-[5px] inline-block h-1.5 w-1.5 rounded-full flex-none " +
                      (s.exitedOn ? "bg-success" : "bg-primary")
                    }
                    aria-hidden
                  />
                  <span className="flex-1 text-foreground-soft">{s.stage}</span>
                  <span className="font-mono text-[11px] text-muted tabular-nums">
                    {s.enteredOn}
                    {s.exitedOn ? ` → ${s.exitedOn}` : " → present"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Documents */}
        {product.documents && product.documents.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1.5">
              Documents
            </div>
            <ul className="space-y-1 text-[12.5px]">
              {product.documents.map((d, i) => (
                <li key={i} className="text-foreground-soft truncate">
                  {d.href ? (
                    <a href={d.href} className="text-primary hover:underline">{d.name}</a>
                  ) : (
                    d.name
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recent activity */}
        {product.changelog && product.changelog.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1.5">
              Recent activity
            </div>
            <ul className="space-y-2">
              {product.changelog.slice(0, 3).map((c, i) => (
                <li key={i} className="text-[12.5px]">
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="font-mono tabular-nums">{c.date}</span>
                    <span>·</span>
                    <span>{c.author}</span>
                  </div>
                  <p className="text-foreground-soft leading-snug mt-0.5">{c.note}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      {product.externalIds?.proprietarySystemId && (
        <div className="px-5 py-2.5 border-t border-border bg-accent/40 flex items-center justify-between gap-3 text-[11.5px]">
          <div className="text-muted truncate">Tracker ref</div>
          <div className="font-mono text-muted-soft truncate">
            {product.externalIds.proprietarySystemId}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">{label}</dt>
      <dd
        className={
          "text-foreground-soft mt-0.5 " + (mono ? "font-mono tabular-nums text-[12px]" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}
