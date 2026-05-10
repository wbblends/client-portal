"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderClosed, FileText, Users, ShieldCheck, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Documents", href: "/documents", icon: FolderClosed },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Quality", href: "/quality", icon: ShieldCheck },
  { label: "Contact", href: "/contact", icon: Users },
  // Sales — internal executive view. Add a role gate here when sales-team
  // accounts exist; today the single seeded user sees everything.
  { label: "Account Penetration", href: "/sales/account-penetration", icon: Thermometer },
];

/**
 * Used in two layouts:
 *  - Desktop sidebar: vertical column
 *  - Mobile inline nav: horizontal scrollable strip
 *
 * Pass `orientation="horizontal"` for the mobile usage.
 */
export function SidebarNav({
  orientation = "vertical",
}: {
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const isHorizontal = orientation === "horizontal";

  return (
    <nav
      className={cn(
        isHorizontal
          ? "flex flex-row gap-1 overflow-x-auto px-2"
          : "flex flex-col gap-0.5 px-3",
      )}
    >
      {NAV.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-2 rounded-lg text-sm font-medium transition-colors shrink-0",
              isHorizontal ? "px-3 py-1.5" : "px-3 py-2 gap-2.5",
              active
                ? "bg-primary-soft text-primary"
                : "text-foreground-soft hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "shrink-0",
                isHorizontal ? "h-4 w-4" : "h-[17px] w-[17px]",
                active ? "text-primary" : "text-muted group-hover:text-foreground-soft",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
