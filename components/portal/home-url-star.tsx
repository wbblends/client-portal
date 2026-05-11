"use client";

import { useState, useTransition } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toggles the signed-in user's "set as homepage" URL to the current
 * pathname + search string. Filled star = this exact URL (path + query) is
 * the saved home; click to clear. Empty star = click to save.
 *
 * The saved URL includes query params on purpose — that's how a user pins a
 * filtered view (e.g. /dashboards/orders?rep=devin&tier=A).
 */
export function HomeUrlStar({
  savedHomeUrl,
  size = "md",
}: {
  savedHomeUrl: string | null;
  size?: "sm" | "md";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Optimistic local state so the star flips instantly. Re-syncs from
  // server props on the next router.refresh().
  const [optimistic, setOptimistic] = useState<string | null | undefined>(undefined);

  const queryString = searchParams.toString();
  const currentUrl = queryString ? `${pathname}?${queryString}` : pathname;
  const effectiveHome = optimistic === undefined ? savedHomeUrl : optimistic;
  const isHome = effectiveHome === currentUrl;

  const iconClass = size === "sm" ? "h-4 w-4" : "h-4 w-4";
  const buttonClass =
    size === "sm"
      ? "inline-flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-accent hover:text-foreground transition-colors"
      : "rounded-md p-1.5 text-muted hover:bg-accent hover:text-foreground transition-colors";

  async function toggle() {
    if (pending) return;
    const next = isHome ? null : currentUrl;
    setOptimistic(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/account/home-url", {
          method: next === null ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: next === null ? undefined : JSON.stringify({ url: next }),
        });
        if (!res.ok) {
          setOptimistic(undefined);
          return;
        }
        router.refresh();
      } catch {
        setOptimistic(undefined);
      }
    });
  }

  const label = isHome ? "Remove as homepage" : "Set as homepage";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={label}
      aria-label={label}
      aria-pressed={isHome}
      className={cn(buttonClass, isHome && "text-primary hover:text-primary")}
    >
      <Star
        className={cn(iconClass, "transition-colors")}
        fill={isHome ? "currentColor" : "none"}
        strokeWidth={isHome ? 1.5 : 2}
      />
    </button>
  );
}
