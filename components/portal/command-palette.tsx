"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  TrendingUp,
  LineChart,
  PieChart,
  Users,
  Briefcase,
  Factory,
  Truck,
  Kanban,
  DollarSign,
  Building2,
  LogOut,
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  TrendingUp,
  LineChart,
  PieChart,
  Users,
  Briefcase,
  Factory,
  Truck,
  Kanban,
  DollarSign,
};

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

export type PaletteItem =
  | { kind: "dashboard"; id: string; label: string; sublabel: string; href: string; icon: LucideIcon }
  | { kind: "customer"; id: string; label: string; sublabel: string; href: string; icon: LucideIcon }
  | { kind: "action"; id: string; label: string; sublabel: string; icon: LucideIcon; run: () => void };

/**
 * Cmd+K palette. Mounted once at the top of the portal layout. Items come
 * from the server (dashboards + customers the user can see) plus a few quick
 * actions (theme toggle, sign out) generated client-side.
 *
 * Trigger: ⌘K / Ctrl+K from anywhere, or click the trigger in the sidebar.
 * Filter is a simple substring match on label + sublabel — fuzzy enough for
 * the size of this dataset without pulling in a fuzzy-search dep.
 */
export function CommandPalette({
  dashboards,
  customers,
  canSwitchCustomers,
}: {
  dashboards: DashboardItem[];
  customers: CustomerItem[];
  canSwitchCustomers: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keybind: ⌘K / Ctrl+K opens, Esc closes (handled inside).
  // Also listens for the `wbb:palette:open` window event so any UI element
  // can open the palette without lifting state up.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isToggle) {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("wbb:palette:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wbb:palette:open", onOpen);
    };
  }, []);

  // When the palette opens, focus the input and reset state. Close on route
  // change so navigation away dismisses it.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Defer to next paint — focusing too early gets eaten by the keypress
      // that opened us.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items = useMemo<PaletteItem[]>(() => {
    const dashItems: PaletteItem[] = dashboards.map(d => ({
      kind: "dashboard",
      id: `dash-${d.id}`,
      label: d.name,
      sublabel: d.category,
      href: `/dashboards/${d.slug}`,
      icon: ICON_MAP[d.iconName] ?? LayoutDashboard,
    }));
    const customerItems: PaletteItem[] = canSwitchCustomers
      ? customers.map(c => ({
          kind: "customer",
          id: `cust-${c.id}`,
          label: c.name,
          sublabel: "Customer · Overview",
          href: `/c/${c.id}/overview`,
          icon: Building2,
        }))
      : [];
    const actions: PaletteItem[] = [
      {
        kind: "action",
        id: "theme-toggle",
        label: "Toggle theme",
        sublabel: "Switch between light and dark mode",
        icon: getCurrentTheme() === "dark" ? Sun : Moon,
        run: () => {
          const cur = getCurrentTheme();
          const next = cur === "dark" ? "light" : "dark";
          const html = document.documentElement;
          html.classList.add("theme-switching");
          html.setAttribute("data-theme", next);
          window.setTimeout(() => html.classList.remove("theme-switching"), 260);
          try {
            localStorage.setItem("wbb.theme", next);
          } catch {
            // ignore
          }
        },
      },
      {
        kind: "action",
        id: "sign-out",
        label: "Sign out",
        sublabel: "End your session",
        icon: LogOut,
        run: async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.replace("/login");
          router.refresh();
        },
      },
    ];
    return [...dashItems, ...customerItems, ...actions];
  }, [dashboards, customers, canSwitchCustomers, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => {
      const haystack = `${item.label} ${item.sublabel}`.toLowerCase();
      return q.split(/\s+/).every(token => haystack.includes(token));
    });
  }, [query, items]);

  // Keep activeIdx in range when filter shrinks the list.
  useEffect(() => {
    if (activeIdx >= filtered.length) {
      setActiveIdx(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, activeIdx]);

  function runItem(item: PaletteItem) {
    if (item.kind === "action") {
      item.run();
      setOpen(false);
      return;
    }
    setOpen(false);
    router.push(item.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIdx];
      if (item) runItem(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Group filtered items for display, preserving the ordering above.
  const grouped = useMemo(() => groupItems(filtered), [filtered]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-palette-fade"
            onClick={() => setOpen(false)}
          />
          <div className="relative mx-auto mt-[12vh] w-[min(640px,calc(100%-2rem))] animate-palette-pop">
            <div className="overflow-hidden rounded-2xl bg-card border border-border shadow-[var(--shadow-popover)]">
              <div className="flex items-center gap-2 px-4 border-b border-border">
                <Search className="h-4 w-4 text-muted shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setActiveIdx(0);
                  }}
                  onKeyDown={onInputKey}
                  placeholder="Search dashboards, customers, actions…"
                  className="flex-1 bg-transparent py-3.5 text-[15px] text-foreground placeholder:text-muted-soft outline-none"
                />
                <kbd className="hidden sm:inline-flex items-center rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  ESC
                </kbd>
              </div>

              <div className="max-h-[60vh] overflow-y-auto py-2">
                {filtered.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted">
                    No matches for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  grouped.map((group, gi) => (
                    <div key={group.label} className={cn(gi > 0 && "mt-1")}>
                      <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-soft">
                        {group.label}
                      </div>
                      <ul role="listbox">
                        {group.items.map(({ item, globalIdx }) => {
                          const Icon = item.icon;
                          const active = globalIdx === activeIdx;
                          return (
                            <li key={item.id} role="option" aria-selected={active}>
                              <button
                                type="button"
                                onMouseEnter={() => setActiveIdx(globalIdx)}
                                onClick={() => runItem(item)}
                                className={cn(
                                  "w-full text-left px-4 py-2 flex items-center gap-3 transition-colors",
                                  active ? "bg-primary-soft" : "hover:bg-accent",
                                )}
                              >
                                <Icon
                                  className={cn(
                                    "h-4 w-4 shrink-0",
                                    active ? "text-primary" : "text-muted",
                                  )}
                                />
                                <div className="min-w-0 flex-1">
                                  <div
                                    className={cn(
                                      "truncate text-sm",
                                      active
                                        ? "text-primary font-medium"
                                        : "text-foreground",
                                    )}
                                  >
                                    {item.label}
                                  </div>
                                  <div className="truncate text-xs text-muted">
                                    {item.sublabel}
                                  </div>
                                </div>
                                {active && (
                                  <kbd className="shrink-0 inline-flex items-center rounded-md border border-primary/20 bg-card px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                    ↵
                                  </kbd>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-[11px] text-muted">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <KbdKey>↑</KbdKey>
                    <KbdKey>↓</KbdKey>
                    <span>navigate</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <KbdKey>↵</KbdKey>
                    <span>open</span>
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <KbdKey>{platformMeta()}</KbdKey>
                  <KbdKey>K</KbdKey>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Standalone trigger — dispatches a `wbb:palette:open` event that the global
 * `<CommandPalette>` listens for. Decouples the trigger location from where
 * the modal is mounted.
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

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-surface px-1 py-0.5 text-[10px] font-medium text-muted">
      {children}
    </kbd>
  );
}

function platformMeta(): string {
  if (typeof navigator === "undefined") return "⌘";
  const ua = navigator.userAgent;
  return /Mac|iPhone|iPad/.test(ua) ? "⌘" : "Ctrl ";
}

function getCurrentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
}

type Group = { label: string; items: { item: PaletteItem; globalIdx: number }[] };

function groupItems(items: PaletteItem[]): Group[] {
  const groups = new Map<string, { item: PaletteItem; globalIdx: number }[]>();
  const order: string[] = [];

  items.forEach((item, i) => {
    const label =
      item.kind === "dashboard"
        ? "Dashboards"
        : item.kind === "customer"
          ? "Customers"
          : "Quick actions";
    if (!groups.has(label)) {
      groups.set(label, []);
      order.push(label);
    }
    groups.get(label)!.push({ item, globalIdx: i });
  });

  return order.map(label => ({ label, items: groups.get(label)! }));
}
