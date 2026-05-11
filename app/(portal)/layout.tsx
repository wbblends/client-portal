import { requireSession } from "@/lib/auth";
import { getDashboardsForUser } from "@/lib/dashboards/registry";
import { listCustomers } from "@/lib/customers/registry";
import { isAdminRole } from "@/lib/users/store";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "@/components/portal/sidebar-nav";
import { UserMenu } from "@/components/portal/user-menu";
import { MobileNav } from "@/components/portal/mobile-nav";
import { BottomTabBar } from "@/components/portal/bottom-tab-bar";
import { CommandPalette, PaletteTrigger } from "@/components/portal/command-palette";
import { CommentLayer } from "@/components/portal/comment-layer";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const dashboards = getDashboardsForUser(user.dashboards, user.role);
  const customers = [...listCustomers()];
  const isAdmin = isAdminRole(user.role);
  const canSwitchCustomers = isAdminRole(user.role) || user.role === "internal";
  const ownCustomerId = user.customerIds[0] ?? null;

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
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr] xl:grid-cols-[280px_1fr]">
      {/* Global command palette — mounted once, opened via ⌘K / Ctrl+K
          or the trigger button in the sidebar. */}
      <CommandPalette
        dashboards={paletteDashboards}
        customers={paletteCustomers}
        canSwitchCustomers={canSwitchCustomers}
      />

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex sticky top-0 h-dvh flex-col border-r border-border bg-card">
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
          />
        </div>
      </aside>

      {/* Mobile/tablet: hamburger top bar + slide-in drawer (replaces the
          old always-visible horizontal nav strip — that ate vertical space
          and didn't expose the customer picker on mobile). */}
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
      />

      {/* Bottom inset reserves room under the mobile/tablet tab bar
          (≈56px tall + iOS safe-area). lg+ resets to 0 since the tab bar is
          hidden there. The reset uses an arbitrary-property utility so it
          can override the inline calc. */}
      <main className="min-w-0 pb-[calc(env(safe-area-inset-bottom)+64px)] lg:pb-0">
        {children}
      </main>

      {/* Mobile/tablet bottom tab bar — only renders inside `/c/<id>/...` */}
      <BottomTabBar ownCustomerId={ownCustomerId} />

      {/* Figma-style page comments. Mounted globally; the `c` hotkey toggles
          comment mode and the floating button in the bottom-right opens it. */}
      <CommentLayer
        currentUser={{
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl ?? null,
        }}
      />
    </div>
  );
}
