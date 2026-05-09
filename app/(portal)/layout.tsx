import { requireSession } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "@/components/portal/sidebar-nav";
import { UserMenu } from "@/components/portal/user-menu";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const isSuperAdmin = user.role === "super_admin";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="hidden lg:flex sticky top-0 h-dvh flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center px-6">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav isSuperAdmin={isSuperAdmin} />
        </div>
        <div className="p-3 border-t border-border">
          <UserMenu
            name={user.name}
            email={user.email}
            company={user.company}
            avatarUrl={user.avatarUrl}
          />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex lg:hidden h-14 items-center justify-between border-b border-border bg-card px-4 sticky top-0 z-10">
        <Logo />
        <UserMenu
          name={user.name}
          email={user.email}
          company={user.company}
          avatarUrl={user.avatarUrl}
          className="border-0 p-0 bg-transparent"
        />
      </header>

      {/* Mobile inline nav — horizontal strip */}
      <div className="lg:hidden border-b border-border bg-card py-2">
        <SidebarNav orientation="horizontal" isSuperAdmin={isSuperAdmin} />
      </div>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
