"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderClosed,
  FileText,
  Users,
  ShieldCheck,
  MessageSquare,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatRealtime } from "@/components/chat/realtime-provider";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** When true, render the Chat unread-count badge next to the label. */
  unreadBadge?: boolean;
  /** When true, render the per-conversation unread dot for this href. */
  unreadDotForHref?: string;
};

/**
 * Used in two layouts:
 *  - Desktop sidebar: vertical column
 *  - Mobile inline nav: horizontal scrollable strip
 *
 * The Chat / Channel items live near the top of the menu so they're reachable
 * from the first row on mobile too.
 */
export function SidebarNav({
  orientation = "vertical",
  channelHref,
}: {
  orientation?: "vertical" | "horizontal";
  /** Per-customer channel deep-link, when one exists for this viewer. */
  channelHref?: string | null;
}) {
  const pathname = usePathname();
  const isHorizontal = orientation === "horizontal";
  const { totalUnread, conversations } = useChatRealtime();

  const channelUnread = channelHref
    ? conversations.find(c => `/chat/${c.id}` === channelHref)?.unread ?? 0
    : 0;

  const NAV: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Chat", href: "/chat", icon: MessageSquare, unreadBadge: true },
    ...(channelHref
      ? [{ label: "Channel", href: channelHref, icon: Hash, unreadDotForHref: channelHref } as NavItem]
      : []),
    { label: "Documents", href: "/documents", icon: FolderClosed },
    { label: "Invoices", href: "/invoices", icon: FileText },
    { label: "Quality", href: "/quality", icon: ShieldCheck },
    { label: "Contact", href: "/contact", icon: Users },
  ];

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
        const showBadge = item.unreadBadge && totalUnread > 0;
        const showDot = !!item.unreadDotForHref && channelUnread > 0;
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-2 rounded-lg text-sm font-medium transition-colors shrink-0",
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
            <span className="flex-1">{item.label}</span>
            {showBadge && (
              <span
                aria-label={`${totalUnread} unread`}
                className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold leading-none text-white tabular-nums"
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
            {showDot && !showBadge && (
              <span
                aria-label={`${channelUnread} unread`}
                className="ml-auto inline-block h-2 w-2 rounded-full bg-danger"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
