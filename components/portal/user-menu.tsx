"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

export function UserMenu({
  name,
  email,
  company,
  avatarUrl,
  className,
  compact = false,
}: {
  name: string;
  email: string;
  company: string;
  avatarUrl?: string;
  className?: string;
  /** Compact mode — avatar + sign-out only, used in the mobile top bar where
   *  horizontal space is precious and the full name+company already shows in
   *  the drawer footer. */
  compact?: boolean;
}) {
  const router = useRouter();
  const initials = name
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-0.5", className)}>
        <ThemeToggle />
        <Avatar name={name} initials={initials} src={avatarUrl} size={28} />
        <button
          type="button"
          onClick={logout}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-accent hover:text-foreground transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border border-border bg-card p-3", className)}>
      <div className="flex items-center gap-3">
        <Avatar name={name} initials={initials} src={avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground break-words leading-tight">{name}</div>
          {company ? (
            <div className="mt-0.5 text-xs text-muted break-words leading-tight">{company}</div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-end gap-0.5 border-t border-border pt-2">
        <ThemeToggle />
        <Link
          href="/account/security"
          className="rounded-md p-1.5 text-muted hover:bg-accent hover:text-foreground transition-colors"
          title="Security"
          aria-label="Security settings"
        >
          <Shield className="h-4 w-4" />
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
    </div>
  );
}

function Avatar({
  name,
  initials,
  src,
  size = 36,
}: {
  name: string;
  initials: string;
  src?: string;
  size?: number;
}) {
  const dim = { width: size, height: size };
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        style={dim}
        className="shrink-0 rounded-full object-cover ring-1 ring-border"
      />
    );
  }
  return (
    <div
      aria-hidden
      style={dim}
      className="grid shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold"
    >
      {initials}
    </div>
  );
}
