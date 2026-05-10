import { requireSession } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "@/components/portal/sidebar-nav";
import { UserMenu } from "@/components/portal/user-menu";
import { PageToolbar } from "@/components/portal/page-toolbar";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="hidden lg:flex sticky top-0 h-dvh flex-col border-r border-border bg-card print:hidden">
        <div className="flex h-16 items-center px-6">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav />
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
      <header className="flex lg:hidden h-14 items-center justify-between border-b border-border bg-card px-4 sticky top-0 z-10 print:hidden">
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
      <div className="lg:hidden border-b border-border bg-card py-2 print:hidden">
        <SidebarNav orientation="horizontal" />
      </div>

      <main className="min-w-0 pb-24 print:pb-0">{children}</main>

      {/* Floating per-page toolbar: find on page, feedback, zoom, export PDF.
          Hidden in print so it never shows up on the exported document. */}
      <PageToolbar />
    </div>
  );
}
