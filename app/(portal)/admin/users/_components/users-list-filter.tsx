"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Role, UserStatus } from "@/lib/users-shared";

type Row = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role: Role;
  roleLabel: string;
  roleTone: BadgeTone;
  status: UserStatus;
  permissionsCount: number;
  isMe: boolean;
};

type Filter = "all" | Role | "disabled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "super_admin", label: "Super admins" },
  { id: "admin", label: "Admins" },
  { id: "user", label: "Users" },
  { id: "disabled", label: "Disabled" },
];

export function UsersListFilter({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (filter === "disabled" && r.status !== "disabled") return false;
      if (filter !== "all" && filter !== "disabled" && r.role !== filter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.username.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  return (
    <div>
      <div className="border-b border-border px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, username, or email…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.id
                  ? "bg-primary-soft text-primary"
                  : "text-foreground-soft hover:bg-accent",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-muted">
          No users match your filter.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map(r => (
            <li key={r.id}>
              <Link
                href={`/admin/users/${r.id}`}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-accent/50 transition-colors"
              >
                <Avatar name={r.name} src={r.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
                    {r.isMe && (
                      <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">
                        You
                      </span>
                    )}
                    {r.status === "disabled" && (
                      <Badge tone="warning">Disabled</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted truncate">
                    @{r.username} · {r.email}
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-3 shrink-0">
                  <Badge tone={r.roleTone}>{r.roleLabel}</Badge>
                  <span className="text-xs text-muted tabular-nums">
                    {r.permissionsCount} perm{r.permissionsCount === 1 ? "" : "s"}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
