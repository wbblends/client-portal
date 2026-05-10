"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /** Hide name + company; show avatar + sign-out only. Used in tight mobile bars. */
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

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-3", className)}>
      <Avatar name={name} initials={initials} src={avatarUrl} />
      {!compact && (
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{name}</div>
          <div className="truncate text-xs text-muted">{company}</div>
        </div>
      )}
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
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
        // The image is hosted from /public — Next/Image will optimize. If the
        // file is missing the request 404s; we fall through to initials only
        // when avatarUrl is undefined (set in lib/auth.ts).
      />
    );
  }
  return (
    <div
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold"
    >
      {initials}
    </div>
  );
}
