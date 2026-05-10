"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useId, useTransition, type ButtonHTMLAttributes } from "react";
import { PAGE_SIZE_COOKIE_PREFIX, PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { cn, formatNumber } from "@/lib/utils";

type Props = {
  total: number;
  page: number;
  pageSize: number;
  /** Query-string key for the page number. Override when multiple paginated lists share a page. */
  pageParam?: string;
  /** Query-string key for the page size. Override when multiple paginated lists share a page. */
  sizeParam?: string;
  /** Allowed page sizes for the size selector. */
  pageSizes?: readonly number[];
  /** Plural noun used in "X–Y of Z {itemLabel}". */
  itemLabel?: string;
  className?: string;
};

export function Pagination({
  total,
  page,
  pageSize,
  pageParam = "page",
  sizeParam = "pageSize",
  pageSizes = PAGE_SIZE_OPTIONS,
  itemLabel = "results",
  className,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const sizeSelectId = useId();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);
  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  // Hide entirely when the list is small enough that even the smallest size
  // option fits — pagination here is pure visual noise.
  const minOption = pageSizes.length > 0 ? Math.min(...pageSizes) : pageSize;
  if (total <= minOption) return null;

  function buildHref(nextPage: number, nextSize?: number) {
    const params = new URLSearchParams(sp.toString());
    if (nextPage <= 1) params.delete(pageParam);
    else params.set(pageParam, String(nextPage));
    if (nextSize != null) params.set(sizeParam, String(nextSize));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function go(nextPage: number) {
    if (nextPage === safePage) return;
    startTransition(() => {
      router.push(buildHref(nextPage), { scroll: false });
    });
  }

  function setSize(nextSize: number) {
    if (nextSize === pageSize) return;
    // Persist the preference for future visits in this namespace. One year is
    // long enough that returning users keep their density, short enough that
    // a stale value gets re-validated against the allowlist eventually.
    if (typeof document !== "undefined") {
      document.cookie = `${PAGE_SIZE_COOKIE_PREFIX}${sizeParam}=${nextSize}; path=/; max-age=31536000; samesite=lax`;
    }
    // Reset to page 1 — the row at the user's current offset is unlikely
    // to still live on the same page once the window changes.
    startTransition(() => {
      router.push(buildHref(1, nextSize), { scroll: false });
    });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 text-sm",
        "border-t border-border",
        pending && "opacity-70",
        className,
      )}
      aria-busy={pending || undefined}
    >
      <div className="flex items-center gap-2">
        <label
          htmlFor={sizeSelectId}
          className="text-[10px] font-semibold uppercase tracking-wide text-muted"
        >
          Show
        </label>
        <select
          id={sizeSelectId}
          value={pageSize}
          onChange={(e) => setSize(Number(e.target.value))}
          disabled={pending}
          className="h-8 rounded-md border border-border bg-card pl-2 pr-7 text-sm font-medium tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {pageSizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="hidden sm:inline text-xs tabular-nums text-muted">
          {total === 0
            ? `0 ${itemLabel}`
            : `${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(total)} ${itemLabel}`}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <span className="sm:hidden mr-1 text-xs tabular-nums text-muted">
          {total === 0
            ? `0 ${itemLabel}`
            : `${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(total)}`}
        </span>
        <PageButton onClick={() => go(1)} disabled={!canPrev || pending} aria-label="First page">
          <ChevronsLeft className="h-4 w-4" />
        </PageButton>
        <PageButton
          onClick={() => go(safePage - 1)}
          disabled={!canPrev || pending}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </PageButton>

        {/* Mobile: compact "Page X of Y" — desktop: numbered links with ellipsis */}
        <span className="sm:hidden px-2 text-xs tabular-nums text-foreground-soft">
          <span className="font-semibold text-foreground">{safePage}</span>
          <span className="text-muted"> / </span>
          <span className="font-semibold text-foreground">{totalPages}</span>
        </span>
        <div className="hidden sm:flex items-center gap-1">
          {buildPageRange(safePage, totalPages).map((entry, idx) =>
            entry === "ellipsis" ? (
              <span
                key={`gap-${idx}`}
                aria-hidden
                className="px-1 text-xs text-muted-soft select-none"
              >
                …
              </span>
            ) : (
              <PageNumberButton
                key={entry}
                page={entry}
                active={entry === safePage}
                onClick={() => go(entry)}
                disabled={pending}
              />
            ),
          )}
        </div>

        <PageButton
          onClick={() => go(safePage + 1)}
          disabled={!canNext || pending}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </PageButton>
        <PageButton
          onClick={() => go(totalPages)}
          disabled={!canNext || pending}
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </PageButton>
      </div>
    </div>
  );
}

/**
 * Returns the visible page entries: always shows page 1 and the last page,
 * a one-page window around the current page, and inserts an `"ellipsis"`
 * marker whenever a gap exists. Up to 7 numeric entries — the markup stays
 * compact even at 1000+ pages.
 */
function buildPageRange(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const result: (number | "ellipsis")[] = [1];
  if (current > 4) result.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) result.push(i);

  if (current < total - 3) result.push("ellipsis");
  result.push(total);
  return result;
}

function PageButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground-soft",
        "hover:border-border-strong hover:bg-accent transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...rest}
    />
  );
}

function PageNumberButton({
  page,
  active,
  className,
  ...rest
}: { page: number; active: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      aria-label={`Go to page ${page}`}
      className={cn(
        "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-xs font-medium tabular-nums transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none",
        active
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary-hover"
          : "border-border bg-card text-foreground-soft hover:border-border-strong hover:bg-accent",
        className,
      )}
      {...rest}
    >
      {page}
    </button>
  );
}
