"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  FolderClosed,
  FileText,
  Users,
  ShieldCheck,
  TrendingUp,
  LineChart,
  PieChart,
  Briefcase,
  Factory,
  Truck,
  Kanban,
  DollarSign,
  Ticket as TicketIcon,
  RefreshCw,
  FlaskConical,
  ClipboardCheck,
  FileSearch,
  FileCheck,
  Tag,
  BadgeCheck,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dashboard } from "@/lib/dashboards/registry";
import type { Customer } from "@/lib/customers/registry";
import { TICKET_TYPES, type TicketTypeIconName } from "@/lib/tickets/registry";
import { CustomerPicker } from "./customer-picker";

const ICONS: Record<Dashboard["iconName"], LucideIcon> = {
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

const TICKET_TYPE_ICONS: Record<TicketTypeIconName, LucideIcon> = {
  FileText,
  RefreshCw,
  FlaskConical,
  ClipboardCheck,
  FileSearch,
  FileCheck,
  Tag,
  BadgeCheck,
};

type AccountLink = {
  /** URL relative to /c/<customerId>/. */
  rel: string;
  label: string;
  icon: LucideIcon;
};

const ACCOUNT_LINKS: AccountLink[] = [
  { rel: "overview", label: "Overview", icon: LayoutDashboard },
  { rel: "documents", label: "Documents", icon: FolderClosed },
  { rel: "invoices", label: "Invoices", icon: FileText },
  { rel: "quality", label: "Quality", icon: ShieldCheck },
  { rel: "contact", label: "Contact", icon: Users },
];

/** localStorage key for which sidebar groups are open. Shape: Record<id, bool>. */
const OPEN_GROUPS_STORAGE_KEY = "portal:sidebar:open-groups";

/**
 * Sidebar navigation. Renders:
 *  - For admin/internal: a customer picker, then the Account section
 *    (Overview / Documents / Invoices / Quality / Contact) linked to
 *    whichever customer is active.
 *  - For customer-role users: the Account section linked to their own id.
 *  - One collapsible "Sales and Marketing" section listing every dashboard
 *    the user has permission for.
 *  - For admins: a collapsible "Project Management" section, one sub-item
 *    per PM ticket type (each its own page under /admin/tickets/<slug>).
 *  - Admin Users link pinned to the bottom of the rail (above the user-menu
 *    footer) via `mt-auto` so it floats to the bottom regardless of how many
 *    sections sit above it.
 *
 * Used in two vertical layouts:
 *  - Desktop sidebar (lg+)
 *  - Mobile drawer (rendered inside <MobileNav>)
 */
export function SidebarNav({
  dashboards,
  customers,
  ownCustomerId,
  isAdmin,
  canSwitchCustomers,
}: {
  dashboards: Dashboard[];
  /** All customers in the registry — only used when canSwitchCustomers is true. */
  customers: Customer[];
  /** A customer-role user's own id, or admin/internal default. Used when no
   *  active customer is in the URL. */
  ownCustomerId: string | null;
  isAdmin: boolean;
  canSwitchCustomers: boolean;
}) {
  const pathname = usePathname();

  // Active customer = whatever's in the URL (/c/<id>/...). Falls back to
  // ownCustomerId. For customer-role users, they're locked to their own id
  // by the route guard regardless.
  const activeCustomerId = extractCustomerIdFromPath(pathname);
  const accountTargetId = activeCustomerId ?? ownCustomerId;

  const customerScopeActive = !!accountTargetId &&
    ACCOUNT_LINKS.some(l => pathname.startsWith(`/c/${accountTargetId}/${l.rel}`));

  const dashboardsActive = dashboards.some(d =>
    pathname === `/dashboards/${d.slug}` ||
    pathname.startsWith(`/dashboards/${d.slug}/`),
  );

  const projectManagementActive = pathname.startsWith("/admin/tickets");

  return (
    <nav className="flex h-full flex-col gap-1.5 px-3">
      {/* Customer Dashboard panel — special primary unit (picker + scoped
           account links). Sits at the top, always visible, like the hero
           "Dashboard" item in the ROCHAINX reference. */}
      {canSwitchCustomers && (
        <CustomerScopePanel
          customers={customers}
          accountTargetId={accountTargetId}
          pathname={pathname}
        />
      )}
      {!canSwitchCustomers && accountTargetId && (
        <CollapsibleGroup
          id="customer-dashboard"
          label="Customer Dashboard"
          pathname={pathname}
          containsActivePath={customerScopeActive}
        >
          {ACCOUNT_LINKS.map(link => (
            <NavLink
              key={link.rel}
              href={`/c/${accountTargetId}/${link.rel}`}
              label={link.label}
              icon={link.icon}
              pathname={pathname}
            />
          ))}
        </CollapsibleGroup>
      )}

      {/* Single consolidated dashboards section. Header is text-only —
           individual items keep their icons. */}
      {dashboards.length > 0 && (
        <CollapsibleGroup
          id="dashboards"
          label="Sales and Marketing"
          pathname={pathname}
          containsActivePath={dashboardsActive}
        >
          {dashboards.map(d => (
            <NavLink
              key={d.id}
              href={`/dashboards/${d.slug}`}
              label={d.name}
              icon={ICONS[d.iconName] ?? LayoutDashboard}
              pathname={pathname}
            />
          ))}
        </CollapsibleGroup>
      )}

      {/* Project Management — admin only, a peer of Sales and Marketing.
           One sub-item per PM ticket type; each links to its own page. */}
      {isAdmin && (
        <CollapsibleGroup
          id="project-management"
          label="Project Management"
          pathname={pathname}
          containsActivePath={projectManagementActive}
        >
          {TICKET_TYPES.map(t => (
            <NavLink
              key={t.slug}
              href={`/admin/tickets/${t.slug}`}
              label={t.label}
              icon={TICKET_TYPE_ICONS[t.iconName] ?? TicketIcon}
              pathname={pathname}
            />
          ))}
        </CollapsibleGroup>
      )}

      {/* Admin Users link pinned to the bottom of the rail, just above the
           user-menu footer. `mt-auto` consumes whatever vertical space is
           left after the other groups. */}
      {isAdmin && (
        <div className="mt-auto pt-2">
          <NavLink
            href="/admin/users"
            label="Users"
            icon={Users}
            pathname={pathname}
          />
        </div>
      )}
    </nav>
  );
}

/**
 * Admin/internal-only panel that visually fuses the customer picker with the
 * Account links scoped to the selected customer. The picker sits as the
 * card header; the links sit beneath, indented behind a left rail so they
 * read as "belonging to" the chosen customer. On customer change the panel
 * pulses briefly to telegraph that the data the links point at has swapped.
 */
function CustomerScopePanel({
  customers,
  accountTargetId,
  pathname,
}: {
  customers: Customer[];
  accountTargetId: string | null;
  pathname: string;
}) {
  const [pulseKey, setPulseKey] = useState(0);
  const lastIdRef = useRef<string | null>(accountTargetId);
  useEffect(() => {
    if (lastIdRef.current !== accountTargetId) {
      lastIdRef.current = accountTargetId;
      setPulseKey(k => k + 1);
    }
  }, [accountTargetId]);

  return (
    <div className="px-1 pb-1">
      <div
        key={pulseKey}
        className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] animate-scope-pulse"
      >
        <CustomerPicker customers={customers} activeCustomerId={accountTargetId} />
        {accountTargetId && (
          <div className="border-t border-border/70 bg-surface/50 px-2 py-1.5">
            <ul className="relative ml-4 border-l border-border-strong/70 pl-2">
              {ACCOUNT_LINKS.map(link => (
                <li key={link.rel}>
                  <NavLink
                    href={`/c/${accountTargetId}/${link.rel}`}
                    label={link.label}
                    icon={link.icon}
                    pathname={pathname}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Reads + writes a single group's open/closed state into a shared
 * `Record<string, boolean>` in localStorage. The initial render uses
 * `defaultOpen`; if a stored value exists, an effect overrides it on mount.
 *
 * SSR caveat: the first paint may briefly show the default state before
 * the effect runs. This is intentional — keeping the lazy initializer pure
 * avoids a hydration mismatch warning. The flash is one frame and only on
 * groups the user has explicitly toggled away from the default.
 */
function useOpenGroupState(groupId: string, defaultOpen: boolean) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OPEN_GROUPS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean> | null;
      if (parsed && typeof parsed === "object" && groupId in parsed) {
        setOpen(Boolean(parsed[groupId]));
      }
    } catch {
      /* ignore corrupt storage — fall back to default */
    }
  }, [groupId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OPEN_GROUPS_STORAGE_KEY);
      const parsed: Record<string, boolean> =
        raw ? (JSON.parse(raw) ?? {}) : {};
      parsed[groupId] = open;
      window.localStorage.setItem(
        OPEN_GROUPS_STORAGE_KEY,
        JSON.stringify(parsed),
      );
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [groupId, open]);

  return [open, setOpen] as const;
}

/**
 * Section header that toggles its children. Clicking the row flips a
 * chevron 180° (down when collapsed → up when expanded) and shows/hides
 * the panel. The group force-opens whenever the active route lives
 * inside it, so deep-linked navigation never leaves the active item
 * hidden behind a collapsed header.
 */
function CollapsibleGroup({
  id,
  label,
  pathname,
  containsActivePath,
  children,
}: {
  id: string;
  label: string;
  pathname: string;
  containsActivePath: boolean;
  children: React.ReactNode;
}) {
  // Default open — we never want to hide existing nav by surprise.
  const [open, setOpen] = useOpenGroupState(id, true);

  // If the user navigates into a route inside this group (deep link, back
  // button, palette jump), force the group open. We deliberately do not
  // auto-close groups that no longer contain the active path — users may
  // have wanted them open.
  useEffect(() => {
    if (containsActivePath) setOpen(true);
    // setOpen is stable from useState; we only want to react to path changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, containsActivePath]);

  const headerId = `sidebar-group-${id}-header`;
  const panelId = `sidebar-group-${id}-panel`;
  const groupHasActive = containsActivePath;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
        className={cn(
          "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          groupHasActive && !open
            // When the active route lives inside a collapsed group, give the
            // header a faint tint so the user can still see "this section is
            // where you are" without opening it.
            ? "text-foreground hover:bg-accent"
            : "text-foreground-soft hover:bg-accent hover:text-foreground",
        )}
      >
        <span className="text-left">{label}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-muted-soft transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        hidden={!open}
        className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-border-strong/40 pl-2"
      >
        {children}
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  pathname: string;
}) {
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors shrink-0 px-3 py-2",
        active
          ? "bg-primary-soft text-primary"
          : "text-foreground-soft hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "shrink-0 h-[17px] w-[17px]",
          active ? "text-primary" : "text-muted group-hover:text-foreground-soft",
        )}
      />
      {label}
    </Link>
  );
}

function extractCustomerIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/c\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
