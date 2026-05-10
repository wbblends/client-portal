"use client";

import { useState } from "react";
import { Popover } from "@/components/ui/popover";
import { CompanyDetailCard } from "@/components/dashboard/company-detail-card";
import type { Company } from "@/lib/data/types";

/**
 * Renders the customer name as the dashboard's H1 and turns it into a
 * popover trigger. Click opens an anchored detail card; outside-click /
 * Escape / scroll closes it.
 */
export function CompanyNameTrigger({ company }: { company: Company }) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={e => {
          setAnchorRect(e.currentTarget.getBoundingClientRect());
          setOpen(o => !o);
        }}
        className="block text-left -ml-1 px-1 rounded-md hover:bg-accent/60 transition-colors"
      >
        <h1 className="font-display text-[34px] leading-[1.1] tracking-tight text-foreground">
          {company.name}
        </h1>
      </button>

      <Popover
        open={open}
        anchorRect={anchorRect}
        onClose={() => setOpen(false)}
        width={460}
      >
        <CompanyDetailCard company={company} />
      </Popover>
    </>
  );
}
