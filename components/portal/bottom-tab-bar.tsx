"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderClosed,
  FileText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { rel: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { rel: "overview", label: "Overview", icon: LayoutDashboard },
  { rel: "documents", label: "Files", icon: FolderClosed },
  { rel: "invoices", label: "Invoices", icon: FileText },
  { rel: "quality", label: "Quality", icon: ShieldCheck },
  { rel: "contact", label: "Contact", icon: Users },
];

/**
 * Fixed bottom tab bar shown on mobile/tablet whenever the user is inside a
 * customer scope (`/c/<id>/...`). Five tabs map to the five account
 * sections — the same set the drawer shows under "Account". This pattern
 * matches every native mobile app the user has muscle memory for and puts
 * the most-tapped destinations within thumb reach.
 *
 * Hidden when:
 *  - the user is anywhere outside `/c/`, since the tabs only make sense
 *    inside a customer scope
 *  - on lg+ where the desktop sidebar already provides the same nav
 */
export function BottomTabBar({ ownCustomerId }: { ownCustomerId: string | null }) {
  const pathname = usePathname();
  const customerId = extractCustomerId(pathname) ?? ownCustomerId;
  if (!customerId || !pathname.startsWith("/c/")) return null;

  return (
    <nav
      aria-label="Customer sections"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map(t => {
          const href = `/c/${customerId}/${t.rel}`;
          const active = pathname === href || pathname.startsWith(href + "/");
          const Icon = t.icon;
          return (
            <li key={t.rel} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "group flex flex-col items-center justify-center gap-0.5 min-h-14 px-1 py-1.5 text-[10.5px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-soft hover:text-foreground active:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform",
                    active ? "scale-110" : "group-active:scale-95",
                  )}
                />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function extractCustomerId(pathname: string): string | null {
  const m = pathname.match(/^\/c\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
