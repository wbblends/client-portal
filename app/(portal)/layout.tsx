import { requireSession } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "@/components/portal/sidebar-nav";
import { UserMenu } from "@/components/portal/user-menu";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Ambient backdrop — gives glass surfaces something colorful to refract. */}
      <div className="glass-bg fixed inset-0 -z-10" aria-hidden />

      {/* Sidebar */}
      <aside className="glass-strong hidden lg:flex sticky top-0 h-dvh flex-col">
        <div className="flex h-16 items-center px-6">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav />
        </div>
        <div className="p-3 border-t border-white/50">
          <UserMenu
            name={user.name}
            email={user.email}
            company={user.company}
            avatarUrl={user.avatarUrl}
            className="border-0 bg-transparent shadow-none backdrop-blur-0"
          />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="glass-strong flex lg:hidden h-14 items-center justify-between px-4 sticky top-0 z-10">
        <Logo />
        <UserMenu
          name={user.name}
          email={user.email}
          company={user.company}
          avatarUrl={user.avatarUrl}
          className="border-0 p-0 bg-transparent shadow-none backdrop-blur-0"
        />
      </header>

      {/* Mobile inline nav — horizontal strip */}
      <div className="glass-strong lg:hidden py-2">
        <SidebarNav orientation="horizontal" />
      </div>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
