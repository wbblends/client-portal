"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X, ChevronDown, ArrowDownUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

export type FilterGroupConfig = {
  /** URL param key for this group. Multi-select values comma-joined. */
  param: string;
  label: string;
  options: FilterOption[];
};

export type SortConfig = {
  /** URL param key, defaults to "sort". Use a prefix on dashboards that host
   *  multiple filter bars (e.g. "oo_sort"). */
  param?: string;
  options: FilterOption[];
  /** Selecting this value drops the param from the URL — used for the
   *  "natural" default sort so URLs stay tidy. */
  defaultValue?: string;
};

/**
 * Stateless filter/sort toolbar that drives a page through URL search params.
 *
 * Server pages parse the same params via `lib/filters.ts` helpers — this
 * component is purely a client UI affordance for editing them.
 */
export function FilterBar({
  searchParam,
  searchPlaceholder = "Search…",
  filterGroups = [],
  sort,
  className,
}: {
  searchParam?: string;
  searchPlaceholder?: string;
  filterGroups?: FilterGroupConfig[];
  sort?: SortConfig;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const sortKey = sort?.param ?? "sort";

  function pushParams(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(sp.toString());
    mutate(params);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function setParam(key: string, value: string | null) {
    pushParams(p => {
      if (value == null || value === "") p.delete(key);
      else p.set(key, value);
    });
  }

  function toggleFilter(param: string, value: string) {
    const current = (sp.get(param) ?? "").split(",").filter(Boolean);
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setParam(param, next.length ? next.join(",") : null);
  }

  // Search input — locally controlled, debounced into the URL so each
  // keystroke doesn't trigger a server round-trip. The Clear button below
  // calls setSearchValue directly, so we don't need an effect to resync
  // from the URL. (Browser back/forward will leave the draft text stale
  // until the next keystroke — acceptable trade-off for the simpler model.)
  const urlSearch = searchParam ? sp.get(searchParam) ?? "" : "";
  const [searchValue, setSearchValue] = useState(urlSearch);
  useEffect(() => {
    if (!searchParam) return;
    if (searchValue === urlSearch) return;
    const t = setTimeout(() => {
      setParam(searchParam, searchValue || null);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const sortValue = sort
    ? sp.get(sortKey) ?? sort.defaultValue ?? sort.options[0]?.value ?? ""
    : "";

  const hasActiveSearch = !!(searchParam && sp.get(searchParam));
  const hasActiveFilters = filterGroups.some(g => !!sp.get(g.param));
  const hasActiveSort =
    !!sort && !!sp.get(sortKey) && sp.get(sortKey) !== sort.defaultValue;
  const showClear = hasActiveSearch || hasActiveFilters || hasActiveSort;

  function clearAll() {
    setSearchValue("");
    pushParams(p => {
      if (searchParam) p.delete(searchParam);
      for (const g of filterGroups) p.delete(g.param);
      if (sort) p.delete(sortKey);
    });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {searchParam && (
          <div className="relative flex-1 min-w-[200px] sm:max-w-[360px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-8 text-sm placeholder:text-muted-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        {sort && sort.options.length > 0 && (
          <SortDropdown
            value={sortValue}
            options={sort.options}
            onChange={v => setParam(sortKey, v === sort.defaultValue ? null : v)}
          />
        )}
        {showClear && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-soft hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>
      {filterGroups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {filterGroups.map(g => {
            const selected = (sp.get(g.param) ?? "").split(",").filter(Boolean);
            return (
              <div key={g.param} className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted mr-1 shrink-0">
                  {g.label}
                </span>
                {g.options.map(o => {
                  const active = selected.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggleFilter(g.param, o.value)}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                        active
                          ? "bg-primary-soft text-primary border-primary/25"
                          : "bg-card text-foreground-soft border-border hover:border-border-strong hover:bg-accent",
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find(o => o.value === value) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:border-border-strong transition-colors"
      >
        <ArrowDownUp className="h-3.5 w-3.5 text-muted" />
        <span className="text-muted">Sort:</span>
        <span className="text-foreground">{current?.label ?? "—"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-[240px] rounded-lg border border-border bg-card p-1 shadow-[var(--shadow-popover)]">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                o.value === value
                  ? "bg-primary-soft text-primary"
                  : "text-foreground-soft hover:bg-accent",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
