import { requireSession } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "@/components/portal/sidebar-nav";
import { UserMenu } from "@/components/portal/user-menu";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return (
    <div className="relative min-h-dvh gradient-mesh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar — liquid glass nav layer floating over the page wash */}
      <aside className="hidden lg:flex sticky top-0 h-dvh flex-col glass glass-nav border-r border-white/30">
        <div className="flex h-16 items-center px-6">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav />
        </div>
        <div className="p-3 border-t border-white/30">
          <UserMenu
            name={user.name}
            email={user.email}
            company={user.company}
            avatarUrl={user.avatarUrl}
          />
        </div>
      </aside>

      {/* Mobile top bar — glass */}
      <header className="flex lg:hidden h-14 items-center justify-between glass glass-nav border-b border-white/30 px-4 sticky top-0 z-10">
        <Logo />
        <UserMenu
          name={user.name}
          email={user.email}
          company={user.company}
          avatarUrl={user.avatarUrl}
          className="border-0 p-0 bg-transparent"
        />
      </header>

      {/* Mobile inline nav — horizontal glass strip */}
      <div className="lg:hidden glass glass-nav border-b border-white/30 py-2 sticky top-14 z-10">
        <SidebarNav orientation="horizontal" />
      </div>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
