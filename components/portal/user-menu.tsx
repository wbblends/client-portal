"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

/**
 * Sidebar profile chip. The avatar + name area is the click target for
 * `/account` — visually reinforced with a hover ring on the avatar and a
 * chevron that fades in on hover, so it's clearly tappable rather than a
 * passive label.
 */
export function UserMenu({
  name,
  email,
  company,
  avatarUrl,
  className,
}: {
  name: string;
  email: string;
  company: string;
  avatarUrl?: string;
  className?: string;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3",
        className,
      )}
    >
      <Link
        href="/account"
        className="group flex flex-1 min-w-0 items-center gap-3 -m-1 p-1 rounded-md hover:bg-accent transition-colors"
        aria-label="Open my account"
        title="My account"
      >
        <span className="relative shrink-0">
          <Avatar
            name={name}
            src={avatarUrl}
            size={36}
            className="transition-shadow group-hover:ring-2 group-hover:ring-primary/50"
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-medium text-foreground" title={email}>
              {name}
            </span>
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-muted opacity-0 -ml-0.5 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          </div>
          <div className="truncate text-xs text-muted">{company}</div>
        </div>
      </Link>
      <button
        type="button"
        onClick={logout}
        className="rounded-md p-1.5 text-muted hover:bg-accent hover:text-foreground transition-colors"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
