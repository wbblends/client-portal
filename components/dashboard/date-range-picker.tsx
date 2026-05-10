"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn, formatDate, formatDateISO } from "@/lib/utils";

type Preset = { id: string; label: string; getRange: () => { from: Date; to: Date } };

const PRESETS: Preset[] = [
  {
    id: "ytd",
    label: "Year to date",
    getRange: () => ({ from: new Date(new Date().getFullYear(), 0, 1), to: new Date() }),
  },
  {
    id: "mtd",
    label: "Month to date",
    getRange: () => ({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    }),
  },
  {
    id: "30d",
    label: "Last 30 days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from, to };
    },
  },
  {
    id: "90d",
    label: "Last 90 days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 89);
      return { from, to };
    },
  },
  {
    id: "12m",
    label: "Last 12 months",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      from.setDate(from.getDate() + 1);
      return { from, to };
    },
  },
  {
    id: "lastyear",
    label: "Last calendar year",
    getRange: () => {
      const y = new Date().getFullYear() - 1;
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
    },
  },
];

export function DateRangePicker({
  from,
  to,
  presetId,
}: {
  from: Date;
  to: Date;
  presetId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(formatDateISO(from));
  const [customTo, setCustomTo] = useState(formatDateISO(to));
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setCustomFrom(formatDateISO(from));
    setCustomTo(formatDateISO(to));
  }, [from, to]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function applyPreset(p: Preset) {
    const r = p.getRange();
    const params = new URLSearchParams(sp.toString());
    params.set("preset", p.id);
    params.delete("from");
    params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function applyCustom() {
    const params = new URLSearchParams(sp.toString());
    params.delete("preset");
    params.set("from", customFrom);
    params.set("to", customTo);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  const activePreset = PRESETS.find(p => p.id === presetId);
  const label = activePreset?.label ?? `${formatDate(from, "short")} – ${formatDate(to, "short")}`;

  return (
    <div className="relative w-full lg:inline-block lg:w-auto">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "inline-flex w-full lg:w-auto items-center justify-between lg:justify-start gap-2 h-10 px-3 rounded-lg border border-border bg-card text-sm font-medium",
          "hover:border-border-strong transition-colors",
        )}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <Calendar className="h-4 w-4 text-muted shrink-0" />
          <span className="text-foreground truncate">{label}</span>
          <span className="text-muted-soft hidden sm:inline">
            ({formatDate(from, "short")} – {formatDate(to, "short")})
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted shrink-0" />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute left-0 right-0 lg:left-auto lg:right-0 z-20 mt-2 w-auto lg:w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-popover)]"
        >
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm transition-colors",
                  presetId === p.id
                    ? "bg-primary-soft text-primary"
                    : "text-foreground-soft hover:bg-accent",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <div className="text-xs font-medium text-muted mb-2">Custom range</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-[11px] text-muted mb-1">From</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] text-muted mb-1">To</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={applyCustom}
              className="mt-3 h-9 w-full rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              Apply custom range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
