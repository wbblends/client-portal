"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderClosed, FileText, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Documents", href: "/documents", icon: FolderClosed },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Quality", href: "/quality", icon: ShieldCheck },
  { label: "Contact", href: "/contact", icon: Users },
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
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg text-base font-semibold transition-colors shrink-0",
              isHorizontal ? "px-4 py-2.5" : "px-4 py-3",
              active
                ? "bg-primary-soft text-primary"
                : "text-foreground hover:bg-accent",
            )}
          >
            <Icon
              className={cn(
                "shrink-0 h-6 w-6",
                active ? "text-primary" : "text-muted group-hover:text-foreground",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
