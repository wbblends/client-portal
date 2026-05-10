"use client";

import { useTransition, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";
import { refreshResources } from "@/lib/cache/actions";
import type { ResourceName } from "@/lib/cache/tiers";

type Props = {
  /** One or more resources to invalidate when clicked. */
  resources: ResourceName | ResourceName[];
  /**
   * Optional scope key (typically the customer id). When provided, only
   * cache entries tagged for this scope are invalidated.
   */
  scope?: string;
  /** Initial "synced at" timestamp shown next to the button. Defaults to now. */
  syncedAt?: Date | string | number;
  /** Hide the relative timestamp. */
  hideTimestamp?: boolean;
  /** Override the visible label. Pass empty string for icon-only. */
  label?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
};

const TICK_INTERVAL_MS = 30_000;

export function RefreshButton({
  resources,
  scope,
  syncedAt,
  hideTimestamp = false,
  label = "Refresh",
  size = "sm",
  variant = "secondary",
  className,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastSynced, setLastSynced] = useState<number>(() => toMs(syncedAt) ?? Date.now());
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const onClick = useCallback(() => {
    startTransition(async () => {
      await refreshResources(resources, scope);
      setLastSynced(Date.now());
      router.refresh();
    });
  }, [resources, scope, router]);

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {!hideTimestamp && (
        <span className="text-xs text-muted tabular-nums" suppressHydrationWarning>
          {pending ? "Refreshing…" : `Updated ${formatRelative(lastSynced)}`}
        </span>
      )}
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={onClick}
        disabled={pending}
        aria-label={label || "Refresh"}
        title={label || "Refresh"}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} aria-hidden />
        {label && <span>{label}</span>}
      </Button>
    </div>
  );
}

function toMs(v: Date | string | number | undefined): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
