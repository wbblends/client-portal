import { requireSession } from "@/lib/auth";
import { getDashboardsForUser } from "@/lib/dashboards/registry";
import { listCustomers } from "@/lib/customers/registry";
import { isAdminRole } from "@/lib/users/store";
import { unreadCountForUser } from "@/lib/notifications/store";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "@/components/portal/sidebar-nav";
import { UserMenu } from "@/components/portal/user-menu";
import { MobileNav } from "@/components/portal/mobile-nav";
import { BottomTabBar } from "@/components/portal/bottom-tab-bar";
import { CommandPalette, PaletteTrigger } from "@/components/portal/command-palette";
import { CommentLayer } from "@/components/portal/comment-layer";
import { PortalShell } from "@/components/portal/portal-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const dashboards = getDashboardsForUser(user.dashboards, user.role);
  const customers = [...listCustomers()];
  const isAdmin = isAdminRole(user.role);
  const canSwitchCustomers = isAdminRole(user.role) || user.role === "internal";
  const ownCustomerId = user.customerIds[0] ?? null;
  // Seed the bell badge so it doesn't flash 0 before the first client poll.
  const initialUnread = await unreadCountForUser(user.username);

  // Strip down dashboards/customers to plain JSON for the client-side
  // command palette (the registry types include extra metadata we don't need
  // to ship over the wire).
  const paletteDashboards = dashboards.map(d => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    category: d.category,
    iconName: d.iconName,
  }));
  const paletteCustomers = customers.map(c => ({ id: c.id, name: c.name }));

  return (
    <PortalShell
      commandPalette={
        <CommandPalette
          dashboards={paletteDashboards}
          customers={paletteCustomers}
          canSwitchCustomers={canSwitchCustomers}
        />
      }
      sidebar={
        <div className="flex flex-col h-full">
          <div className="flex h-16 items-center px-6">
            <Logo />
          </div>
          <div className="px-3 pb-2">
            <PaletteTrigger />
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            <SidebarNav
              dashboards={dashboards}
              customers={customers}
              ownCustomerId={ownCustomerId}
              isAdmin={isAdmin}
              canSwitchCustomers={canSwitchCustomers}
            />
          </div>
          <div className="p-3 border-t border-border">
            <UserMenu
              name={user.name}
              email={user.email}
              company={user.company}
              avatarUrl={user.avatarUrl ?? undefined}
              initialUnread={initialUnread}
            />
          </div>
        </div>
      }
      mobile={
        <MobileNav
          dashboards={dashboards}
          customers={customers}
          ownCustomerId={ownCustomerId}
          isAdmin={isAdmin}
          canSwitchCustomers={canSwitchCustomers}
          user={{
            name: user.name,
            email: user.email,
            company: user.company,
            avatarUrl: user.avatarUrl ?? undefined,
          }}
          initialUnread={initialUnread}
        />
      }
      bottomBar={<BottomTabBar ownCustomerId={ownCustomerId} />}
      comments={
        <CommentLayer
          currentUser={{
            username: user.username,
            name: user.name,
            avatarUrl: user.avatarUrl ?? null,
          }}
        />
      }
    >
      {children}
    </PortalShell>
  );
}
