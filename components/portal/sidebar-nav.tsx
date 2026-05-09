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
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dashboard, DashboardCategory } from "@/lib/dashboards/registry";
import type { Customer } from "@/lib/customers/registry";
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

/**
 * Sidebar navigation. Renders:
 *  - For admin/internal: a customer picker, then the Account section
 *    (Overview / Documents / Invoices / Quality / Contact) linked to
 *    whichever customer is active.
 *  - For customer-role users: the Account section linked to their own id.
 *  - Cross-customer dashboards the user has permission for, grouped by category.
 *  - Admin link to /admin/users for admins only.
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

  const grouped = groupByCategory(dashboards);

  // Active customer = whatever's in the URL (/c/<id>/...). Falls back to
  // ownCustomerId. For customer-role users, they're locked to their own id
  // by the route guard regardless.
  const activeCustomerId = extractCustomerIdFromPath(pathname);
  const accountTargetId = activeCustomerId ?? ownCustomerId;

  return (
    <nav className="flex flex-col gap-4 px-3">
      {/* Switcher view (admin/internal, desktop): picker + Account links live
           in one bordered card so it's obvious switching the customer swaps
           every link below. */}
      {canSwitchCustomers && (
        <CustomerScopePanel
          customers={customers}
          accountTargetId={accountTargetId}
          pathname={pathname}
        />
      )}

      {/* Non-switchers (customer-role): classic Account section. */}
      {!canSwitchCustomers && accountTargetId && (
        <Group label="Account">
          {ACCOUNT_LINKS.map(link => (
            <NavLink
              key={link.rel}
              href={`/c/${accountTargetId}/${link.rel}`}
              label={link.label}
              icon={link.icon}
              pathname={pathname}
            />
          ))}
        </Group>
      )}

      {/* Cross-customer dashboards. */}
      {grouped.map(({ category, items }) => (
        <Group key={category} label={category}>
          {items.map(d => (
            <NavLink
              key={d.id}
              href={`/dashboards/${d.slug}`}
              label={d.name}
              icon={ICONS[d.iconName] ?? LayoutDashboard}
              pathname={pathname}
            />
          ))}
        </Group>
      ))}

      {isAdmin && (
        <Group label="Admin">
          <NavLink
            href="/admin/users"
            label="Users"
            icon={Settings}
            pathname={pathname}
          />
        </Group>
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
    <div className="px-1">
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

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-soft">
        {label}
      </div>
      {children}
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

function groupByCategory(
  dashboards: Dashboard[],
): { category: DashboardCategory; items: Dashboard[] }[] {
  const order: DashboardCategory[] = [
    "Executive",
    "Sales",
    "Department",
    "Board",
    "Customer Success",
    "Marketing",
  ];
  const map = new Map<DashboardCategory, Dashboard[]>();
  for (const d of dashboards) {
    if (!map.has(d.category)) map.set(d.category, []);
    map.get(d.category)!.push(d);
  }
  return order
    .filter(c => map.has(c))
    .map(c => ({ category: c, items: map.get(c)! }));
}
