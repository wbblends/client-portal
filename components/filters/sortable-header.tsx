"use client";

import { Suspense, useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { mergeParams, nextSortState, type SortDirection } from "@/lib/filters/url-state";

type SortableHeaderProps = {
  column: string;
  label: string;
  /** Default direction the first click should set. Defaults to "asc". */
  defaultDirection?: SortDirection;
  /** Tailwind classes for alignment / sizing — applied to the wrapping <th>. */
  className?: string;
  /** Right-aligned numeric columns reverse the icon side for readability. */
  align?: "left" | "right";
};

/**
 * Click-to-sort table header backed by `?sort=&dir=` URL params. Drop into a
 * <thead> in place of a plain <th>. Pairs with `readSort` server-side.
 */
export function SortableHeader(props: SortableHeaderProps) {
  return (
    <th scope="col" className={props.className}>
      <Suspense
        fallback={
          <span className="inline-flex items-center gap-1.5">
            {props.label}
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          </span>
        }
      >
        <SortableHeaderButton {...props} />
      </Suspense>
    </th>
  );
}

function SortableHeaderButton({
  column,
  label,
  defaultDirection = "asc",
  align = "left",
}: SortableHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeColumn = searchParams.get("sort");
  const activeDir = searchParams.get("dir") as SortDirection | null;
  const isActive = activeColumn === column;
  const current: SortDirection | null = isActive ? activeDir ?? defaultDirection : null;

  const onClick = useCallback(() => {
    const next = nextSortState(
      {
        column: activeColumn ?? "",
        direction: activeDir === "asc" || activeDir === "desc" ? activeDir : defaultDirection,
      },
      column,
      defaultDirection,
    );
    const qs = mergeParams(new URLSearchParams(searchParams.toString()), {
      sort: next.column,
      dir: next.direction,
    });
    const url = qs.length > 0 ? `${pathname}?${qs}` : pathname;
    startTransition(() => router.replace(url, { scroll: false }));
  }, [router, pathname, searchParams, activeColumn, activeDir, column, defaultDirection]);

  const Icon = current === "asc" ? ArrowUp : current === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide",
        "text-[11px] text-muted hover:text-foreground transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded",
        isActive && "text-foreground",
        align === "right" && "flex-row-reverse",
      )}
      aria-sort={current === "asc" ? "ascending" : current === "desc" ? "descending" : "none"}
    >
      <span>{label}</span>
      <Icon className={cn("h-3 w-3", isActive ? "opacity-100" : "opacity-40")} />
    </button>
  );
}
