"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Client wrapper around the portal grid. Owns the desktop-sidebar
 * collapsed state (persisted to localStorage) and renders a floating
 * arrow button on the sidebar/main boundary to toggle it.
 *
 * Mobile/tablet (<lg) doesn't show the sidebar at all, so the toggle
 * is hidden there too.
 */
export function PortalShell({
  sidebar,
  commandPalette,
  mobile,
  bottomBar,
  comments,
  children,
}: {
  sidebar: React.ReactNode;
  commandPalette: React.ReactNode;
  mobile: React.ReactNode;
  bottomBar: React.ReactNode;
  comments: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("portal-sidebar-collapsed");
    if (saved === "1") setCollapsed(true);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      "portal-sidebar-collapsed",
      collapsed ? "1" : "0",
    );
  }, [collapsed, hydrated]);

  // Suppress transitions until after hydration so a saved-collapsed state
  // doesn't animate in on first paint.
  const animate = hydrated;

  return (
    <div
      className={cn(
        "min-h-dvh lg:grid",
        animate &&
          "transition-[grid-template-columns] duration-300 ease-in-out",
        collapsed
          ? "lg:grid-cols-[0px_1fr]"
          : "lg:grid-cols-[260px_1fr] xl:grid-cols-[280px_1fr]",
      )}
    >
      {commandPalette}

      <aside
        className={cn(
          "hidden lg:flex sticky top-0 h-dvh flex-col border-r border-border bg-card overflow-hidden",
          animate && "transition-[opacity,transform] duration-300 ease-in-out",
          collapsed && "opacity-0 -translate-x-3 pointer-events-none",
        )}
      >
        {sidebar}
      </aside>

      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "hidden lg:flex fixed top-5 z-30 h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground-soft shadow-md hover:bg-accent hover:text-foreground",
          animate && "transition-[left] duration-300 ease-in-out",
          collapsed ? "left-1" : "left-[246px] xl:left-[266px]",
        )}
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4",
            animate && "transition-[rotate] duration-300 ease-in-out",
            collapsed && "rotate-180",
          )}
        />
      </button>

      {mobile}

      {/* Bottom-bar spacing is owned by <BottomTabBar /> — it renders its
          own in-flow spacer when (and only when) the fixed bar is visible,
          so pages outside `/c/<id>/...` (dashboard, admin, account) don't
          carry ~64px of empty space at the bottom on mobile. */}
      <main className="min-w-0">
        {children}
      </main>

      {bottomBar}

      {comments}
    </div>
  );
}
