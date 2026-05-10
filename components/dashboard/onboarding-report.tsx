"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover } from "@/components/ui/popover";
import { OnboardingDetailCard } from "@/components/dashboard/onboarding-detail-card";
import type { OnboardingProduct } from "@/lib/data/onboarding";
import { ONBOARDING_STAGE_META } from "@/lib/data/onboarding";

/**
 * Onboarding Products Report — every SKU we're working through with this
 * customer that hasn't yet hit recurring production. Same banner treatment
 * as the open-orders report so the two read as a family.
 *
 * Mobile: collapses to a card stack so the long Last Note doesn't blow up
 * row heights when the table overflows horizontally.
 *
 * Click a row (or card on mobile) to pop a detail card anchored to it.
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const openProduct = openId ? products.find(p => p.id === openId) ?? null : null;

  function handleOpen(e: React.MouseEvent<HTMLElement>, id: string) {
    setAnchorRect(e.currentTarget.getBoundingClientRect());
    setOpenId(id);
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-card)]">
        <div className="bg-primary text-primary-foreground px-5 py-3.5">
          <h3 className="font-display text-[20px] leading-tight">
            {customerName} — Onboarding Statuses
          </h3>
        </div>
        <div className="bg-primary/15 text-primary px-5 py-1.5 text-[13px] font-semibold tracking-tight">
          Commercialization Pipeline: {reportDate}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-semibold">SKU</th>
                <th className="px-3 py-2.5 font-semibold">Product</th>
                <th className="px-3 py-2.5 font-semibold">Format</th>
                <th className="px-3 py-2.5 font-semibold">Stage</th>
                <th className="px-3 py-2.5 font-semibold">Owner</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Last Update</th>
                <th className="px-4 py-2.5 font-semibold">Last Note</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const meta = ONBOARDING_STAGE_META[p.stage];
                const isOpen = openId === p.id;
                return (
                  <tr
                    key={p.id}
                    onClick={e => handleOpen(e, p.id)}
                    className={
                      "border-b border-border last:border-b-0 align-top cursor-pointer transition-colors " +
                      (isOpen ? "bg-primary-soft/60" : "hover:bg-accent/40")
                    }
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-foreground-soft whitespace-nowrap">
                      {p.sku}
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground min-w-[180px]">
                      {p.productName}
                      <div className="text-xs text-muted mt-0.5">{p.count}</div>
                    </td>
                    <td className="px-3 py-3 text-foreground-soft whitespace-nowrap">{p.format}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Badge tone={meta.tone}>{p.stage}</Badge>
                    </td>
                    <td className="px-3 py-3 text-foreground-soft whitespace-nowrap">{p.owner}</td>
                    <td className="px-3 py-3 text-muted whitespace-nowrap tabular-nums">
                      {p.lastUpdated}
                    </td>
                    <td className="px-4 py-3 max-w-[440px] text-[13px] text-foreground-soft leading-snug">
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
            const isOpen = openId === p.id;
            return (
              <li
                key={p.id}
                onClick={e => handleOpen(e, p.id)}
                className={"p-4 cursor-pointer " + (isOpen ? "bg-primary-soft/60" : "")}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge tone={meta.tone}>{p.stage}</Badge>
                  <span className="font-mono text-[11px] text-muted">{p.sku}</span>
                </div>
                <h4 className="mt-1.5 text-sm font-semibold text-foreground leading-snug">
                  {p.productName}
                </h4>
                <div className="text-[12px] text-muted">
                  {p.format} · {p.count}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                  <span>Owner: <span className="text-foreground-soft">{p.owner}</span></span>
                  <span className="tabular-nums">Updated {p.lastUpdated}</span>
                </div>
                <p className="mt-2 text-[13px] text-foreground-soft leading-snug">{p.lastNote}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <Popover
        open={!!openProduct}
        anchorRect={anchorRect}
        onClose={() => setOpenId(null)}
        width={460}
      >
        {openProduct && <OnboardingDetailCard product={openProduct} />}
      </Popover>
    </>
  );
}
