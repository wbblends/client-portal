"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lazy wrapper around the ⌘K command palette.
 *
 * The palette is mounted once at the top of the portal layout, so its code
 * would otherwise ship in every page's bundle despite only being needed when
 * the user actually opens it. This wrapper ships nothing but a tiny keydown
 * listener; the real palette (`command-palette-impl`) is fetched as its own
 * chunk on the first ⌘K / trigger and stays mounted afterwards.
 */

type DashboardItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  iconName: string;
};

type CustomerItem = {
  id: string;
  name: string;
};

const CommandPaletteImpl = dynamic(
  () => import("./command-palette-impl").then(m => m.CommandPalette),
  { ssr: false },
);

export function CommandPalette(props: {
  dashboards: DashboardItem[];
  customers: CustomerItem[];
  canSwitchCustomers: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  // Until the palette is first invoked, listen for the same triggers the real
  // palette would (⌘K / Ctrl+K and the `wbb:palette:open` event). On the first
  // hit we mount the impl with `startOpen` so it opens in the same gesture;
  // from then on the impl owns these listeners itself.
  useEffect(() => {
    if (mounted) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMounted(true);
      }
    }
    function onOpen() {
      setMounted(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("wbb:palette:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wbb:palette:open", onOpen);
    };
  }, [mounted]);

  if (!mounted) return null;
  return <CommandPaletteImpl {...props} startOpen />;
}

/**
 * Standalone trigger — dispatches a `wbb:palette:open` event that the global
 * `<CommandPalette>` listens for. Decouples the trigger location from where
 * the modal is mounted. Kept in this lightweight module (not the impl chunk)
 * so the sidebar can render it without pulling in the full palette.
 */
export function PaletteTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("wbb:palette:open"))}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg border border-border bg-card",
        "px-2.5 py-1.5 text-sm text-muted hover:border-border-strong hover:bg-accent transition-colors",
        className,
      )}
      aria-label="Open command palette"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left text-[13px]">Search…</span>
      <kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
        {platformMeta()}K
      </kbd>
    </button>
  );
}

function platformMeta(): string {
  if (typeof navigator === "undefined") return "⌘";
  const ua = navigator.userAgent;
  return /Mac|iPhone|iPad/.test(ua) ? "⌘" : "Ctrl ";
}
