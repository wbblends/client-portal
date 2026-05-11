"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { HomeUrlStar } from "./home-url-star";

export function UserMenu({
  name,
  email,
  company,
  avatarUrl,
  homeUrl,
  className,
  compact = false,
}: {
  name: string;
  email: string;
  company: string;
  avatarUrl?: string;
  /** Saved "set as homepage" URL — drives filled/empty state of the star.
   *  null when the user hasn't pinned a page yet. */
  homeUrl: string | null;
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
        <Suspense fallback={null}>
          <HomeUrlStar savedHomeUrl={homeUrl} size="sm" />
        </Suspense>
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
    <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-3", className)}>
      <Avatar name={name} initials={initials} src={avatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{name}</div>
        <div className="truncate text-xs text-muted">{company}</div>
      </div>
      <div className="flex items-center gap-0.5">
        <Suspense fallback={null}>
          <HomeUrlStar savedHomeUrl={homeUrl} />
        </Suspense>
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
      className="grid shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-[12px] font-semibold"
    >
      {initials}
    </div>
  );
}
