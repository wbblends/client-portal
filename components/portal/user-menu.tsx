"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

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
    <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-3", className)}>
      <Link
        href="/account"
        className="flex flex-1 min-w-0 items-center gap-3 -m-1 p-1 rounded-md hover:bg-accent transition-colors"
        title="Open my account"
      >
        <Avatar name={name} src={avatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground" title={email}>{name}</div>
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
