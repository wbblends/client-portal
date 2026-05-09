"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import type { Customer } from "@/lib/customers/registry";

/**
 * Header trigger for admin/internal users to switch the active customer. On
 * change, navigates to `/c/<id>/<currentSubsection>` (preserving the section
 * when present, falling back to `/overview`).
 *
 * Designed to live as the header of the customer panel in the sidebar — not
 * as a standalone bordered widget. The picker, the customer it identifies,
 * and the Account links beneath it are presented as one unit so it's obvious
 * that switching the customer swaps every data view in the panel.
 *
 * Hidden for `customer` role users — they can only see one customer.
 */
export function CustomerPicker({
  customers,
  activeCustomerId,
}: {
  customers: Customer[];
  /** The customer currently in the URL, or null when not on a /c/* route. */
  activeCustomerId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const active = customers.find(c => c.id === activeCustomerId) ?? null;
  const initial = (active?.name ?? "?").trim().charAt(0).toUpperCase();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id || id === activeCustomerId) return;
    const m = pathname.match(/^\/c\/[^/]+(\/.*)?$/);
    const rest = m && m[1] ? m[1] : "/overview";
    router.push(`/c/${id}${rest}`);
  }

  return (
    <div className="relative group">
      <div className="flex items-center gap-2.5 rounded-t-xl px-3 py-2.5 transition-colors group-hover:bg-primary-soft/60">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[12px] font-semibold text-primary-foreground"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-soft leading-none">
            Viewing
          </div>
          <div className="truncate text-sm font-semibold text-foreground leading-tight mt-1">
            {active?.name ?? "Select a customer…"}
          </div>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" />
      </div>
      <select
        aria-label="Active customer"
        value={activeCustomerId ?? ""}
        onChange={onChange}
        className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent text-transparent opacity-0 focus:opacity-100 focus:ring-2 focus:ring-primary/40 focus:outline-none rounded-t-xl"
      >
        {!activeCustomerId && (
          <option value="" disabled>
            Select a customer…
          </option>
        )}
        {customers.map(c => (
          <option key={c.id} value={c.id} className="text-foreground">
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
