"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import type { Dashboard } from "@/lib/dashboards/registry";
import type { Customer } from "@/lib/customers/registry";

/**
 * Mobile/tablet top bar with a hamburger that opens the full sidebar nav as
 * a slide-in drawer. Replaces the old always-visible horizontal-scroll nav
 * strip — that pattern fought the dashboard for vertical space and felt
 * neither web nor app-native. This is the standard mobile-app pattern.
 *
 * The drawer:
 *  - locks page scroll while open
 *  - closes on route change, on backdrop click, on Escape
 *  - reuses the same SidebarNav as desktop so admin/internal users still
 *    get the customer picker on mobile (the old horizontal strip hid it)
 */
export function MobileNav({
  dashboards,
  customers,
  ownCustomerId,
  isAdmin,
  canSwitchCustomers,
  user,
}: {
  dashboards: Dashboard[];
  customers: Customer[];
  ownCustomerId: string | null;
  isAdmin: boolean;
  canSwitchCustomers: boolean;
  user: {
    name: string;
    email: string;
    company: string;
    avatarUrl?: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open + Esc-to-close.
  //
  // iOS Safari ignores `overflow: hidden` on body for scroll locking, so we
  // pin the body at the current scroll position with `position: fixed` and
  // restore it on close. The old overflow-only approach caused the page to
  // jump to the top on iOS after closing the drawer.
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 h-14"
        style={{
          paddingLeft: "max(env(safe-area-inset-left), 1rem)",
          paddingRight: "max(env(safe-area-inset-right), 1rem)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          className="-ml-1 inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground-soft hover:bg-accent hover:text-foreground transition-colors active:bg-primary-soft"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo size="sm" />
        <div className="ml-auto">
          <UserMenu
            name={user.name}
            email={user.email}
            company={user.company}
            avatarUrl={user.avatarUrl}
            className="border-0 p-0 bg-transparent gap-2"
            compact
          />
        </div>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/40 animate-drawer-fade"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-[min(86vw,320px)] flex-col bg-card shadow-[0_24px_48px_-12px_rgba(21,16,43,0.4)] animate-drawer-slide"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
              paddingLeft: "env(safe-area-inset-left)",
            }}
          >
            <div className="flex h-14 items-center justify-between px-4 border-b border-border shrink-0">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground-soft hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              <SidebarNav
                dashboards={dashboards}
                customers={customers}
                ownCustomerId={ownCustomerId}
                isAdmin={isAdmin}
                canSwitchCustomers={canSwitchCustomers}
              />
            </div>
            <div className="p-3 border-t border-border shrink-0">
              <UserMenu
                name={user.name}
                email={user.email}
                company={user.company}
                avatarUrl={user.avatarUrl}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
