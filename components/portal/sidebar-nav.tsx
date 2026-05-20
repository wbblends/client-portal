"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
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
import {
  DASHBOARD_CATEGORY_ORDER,
  type Dashboard,
  type DashboardCategory,
} from "@/lib/dashboards/registry";
import type { Customer } from "@/lib/customers/registry";
import { TICKET_TYPES, type TicketTypeIconName } from "@/lib/tickets/registry";
import { CompanyLogo } from "@/components/dashboards/deal-card";

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
 *  - For customer-role users: a "Customer Dashboard" section linked to
 *    their own id (Overview / Documents / Invoices / Quality / Contact).
 *  - One collapsible "Sales and Marketing" section listing every dashboard
 *    the user has permission for.
 *  - For admins: a collapsible "Project Management" section, one sub-item
 *    per PM ticket type (each its own page under /admin/tickets/<slug>).
 *  - For admin/internal: a collapsible "Customers" section pinned near the
 *    bottom of the rail. Each customer is itself a nested collapsible
 *    expanding to that customer's Account links — replaces the old
 *    customer-picker panel that sat at the top of the sidebar.
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

  // Group dashboards by category, ordered by DASHBOARD_CATEGORY_ORDER.
  const dashboardGroups: Array<{
    category: DashboardCategory;
    groupId: string;
    dashboards: Dashboard[];
    containsActivePath: boolean;
  }> = (() => {
    const byCategory = new Map<DashboardCategory, Dashboard[]>();
    for (const d of dashboards) {
      const list = byCategory.get(d.category) ?? [];
      list.push(d);
      byCategory.set(d.category, list);
    }
    const ordered: DashboardCategory[] = [
      ...DASHBOARD_CATEGORY_ORDER.filter(c => byCategory.has(c)),
      ...[...byCategory.keys()].filter(
        c => !DASHBOARD_CATEGORY_ORDER.includes(c),
      ),
    ];
    return ordered.map(category => {
      const groupDashes = byCategory.get(category)!;
      return {
        category,
        groupId: `dashboards-${category.toLowerCase().replace(/\s+/g, "-")}`,
        dashboards: groupDashes,
        containsActivePath: groupDashes.some(
          d =>
            pathname === `/dashboards/${d.slug}` ||
            pathname.startsWith(`/dashboards/${d.slug}/`),
        ),
      };
    });
  })();

  const projectManagementActive = pathname.startsWith("/admin/tickets");

  return (
    <nav className="flex h-full flex-col gap-1.5 px-3">
      {/* Home — the portal's default landing page. Pinned at the very top
           of the rail above every collapsible section so it's always one
           click away. Clicking it (or otherwise landing on /home) causes
           every CollapsibleGroup below to collapse — see the effect inside
           CollapsibleGroup that watches for pathname === "/home". */}
      <NavLink
        href="/home"
        label="Home"
        icon={Home}
        pathname={pathname}
      />

      {/* Customer-role users see their own Customer Dashboard pinned at the
           top — they can't switch customers, so the picker/dropdown UI for
           admins doesn't apply. Admins navigate to a customer via the
           "Customers" section near the bottom of the rail. */}
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

      {/* One collapsible section per dashboard category. Categories are
           ordered by DASHBOARD_CATEGORY_ORDER in the registry; items inside
           keep their icons. */}
      {dashboardGroups.map(group => (
        <CollapsibleGroup
          key={group.category}
          id={group.groupId}
          label={group.category}
          pathname={pathname}
          containsActivePath={group.containsActivePath}
        >
          {group.dashboards.map(d => (
            <NavLink
              key={d.id}
              href={`/dashboards/${d.slug}`}
              label={d.name}
              icon={ICONS[d.iconName] ?? LayoutDashboard}
              pathname={pathname}
            />
          ))}
        </CollapsibleGroup>
      ))}

      {/* Projects — admin only, a peer of Sales and Marketing.
           An Analytics roll-up pinned to the top, then one sub-item per PM
           ticket type; each links to its own page. */}
      {isAdmin && (
        <CollapsibleGroup
          id="project-management"
          label="Projects"
          suffix="work in progress"
          dim
          wip
          pathname={pathname}
          containsActivePath={projectManagementActive}
        >
          <NavLink
            href="/admin/tickets/analytics"
            label="Analytics"
            icon={PieChart}
            pathname={pathname}
          />
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

      {/* Customers — admin/internal only. Top-level peer of Project
           Management; sits below it. Each customer is itself a nested
           collapsible that, when opened, reveals the Account links
           (Overview / Documents / Invoices / Quality / Contact) scoped to
           that customer. Replaces the old customer picker panel. */}
      {canSwitchCustomers && (
        <CollapsibleGroup
          id="customers"
          label="Customers"
          suffix="work in progress"
          dim
          wip
          pathname={pathname}
          containsActivePath={!!activeCustomerId}
        >
          {customers.map(c => (
            <CollapsibleGroup
              key={c.id}
              id={`customer-${c.id}`}
              label={c.name}
              leading={
                c.domain ? (
                  <CompanyLogo domain={c.domain} name={c.name} />
                ) : (
                  <div className="h-6 w-6 shrink-0 rounded border border-border bg-surface" />
                )
              }
              pathname={pathname}
              containsActivePath={
                pathname === `/c/${c.id}` ||
                pathname.startsWith(`/c/${c.id}/`)
              }
              defaultOpen={false}
            >
              {ACCOUNT_LINKS.map(link => (
                <NavLink
                  key={link.rel}
                  href={`/c/${c.id}/${link.rel}`}
                  label={link.label}
                  icon={link.icon}
                  pathname={pathname}
                />
              ))}
            </CollapsibleGroup>
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
  suffix,
  leading,
  dim,
  wip,
  pathname,
  containsActivePath,
  defaultOpen = true,
  children,
}: {
  id: string;
  label: string;
  /** Optional short tag rendered next to the label in a fainter style — used
   *  to mark sections like "Customers" as work-in-progress without obscuring
   *  the primary label. */
  suffix?: string;
  /** Optional node rendered to the left of the label in the header (e.g.
   *  a customer logo). When omitted the header keeps its text-only layout. */
  leading?: React.ReactNode;
  /** Render the header in a softer tint than the default. Used to de-
   *  emphasize sections that aren't fully wired up yet. */
  dim?: boolean;
  /** Give the header a light-yellow wash to flag a section as not yet
   *  developed. Pairs with `suffix="work in progress"`. */
  wip?: boolean;
  pathname: string;
  containsActivePath: boolean;
  /** Default open state, used only on first render before localStorage is
   *  consulted. Set to false for groups that would otherwise overwhelm the
   *  rail when all expanded by default (e.g. the per-customer nested
   *  collapsibles inside the Customers section). */
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useOpenGroupState(id, defaultOpen);

  // If the user navigates into a route inside this group (deep link, back
  // button, palette jump), force the group open. We deliberately do not
  // auto-close groups that no longer contain the active path — users may
  // have wanted them open.
  useEffect(() => {
    if (containsActivePath) setOpen(true);
    // setOpen is stable from useState; we only want to react to path changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, containsActivePath]);

  // Navigating to /home collapses every group, giving the homepage a clean
  // rail. Only fires on the pathname transition — if the user manually
  // opens a group while staying on /home, it doesn't snap shut.
  useEffect(() => {
    if (pathname === "/home") setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
            : dim
              ? "text-muted hover:bg-accent hover:text-foreground-soft"
              : "text-foreground-soft hover:bg-accent hover:text-foreground",
          // WIP sections get a light-yellow wash so users can tell at a
          // glance the area isn't built out yet. Kept after the color
          // branches so it overrides their hover background.
          wip && "bg-amber-100/70 hover:bg-amber-100",
        )}
      >
        {leading ? (
          <span className="flex min-w-0 items-center gap-2 text-left">
            {leading}
            <span className="truncate">{label}</span>
            {suffix && (
              <span className="text-xs font-normal italic text-muted-soft">
                {suffix}
              </span>
            )}
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-2 text-left">
            <span className="truncate">{label}</span>
            {suffix && (
              <span className="text-xs font-normal italic text-muted-soft">
                {suffix}
              </span>
            )}
          </span>
        )}
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
