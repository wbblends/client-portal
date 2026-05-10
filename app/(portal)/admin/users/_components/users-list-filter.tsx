"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search, ChevronRight, X, ShieldAlert, Trash2, Power, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Role, UserStatus } from "@/lib/users-shared";
import {
  bulkDeleteAction,
  bulkResetPermissionsAction,
  bulkUpdateStatusAction,
  type BulkResult,
} from "../actions";

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
  twoFactorEnabled: boolean;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

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

  const visibleSelectableIds = filtered.filter(r => !r.isMe).map(r => r.id);
  const allVisibleSelected =
    visibleSelectableIds.length > 0 && visibleSelectableIds.every(id => selected.has(id));
  const someVisibleSelected = visibleSelectableIds.some(id => selected.has(id));

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleSelectableIds) next.delete(id);
      } else {
        for (const id of visibleSelectableIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setConfirmDelete(false);
    setBulkMessage(null);
  }

  function runBulk(action: (formData: FormData) => Promise<BulkResult>) {
    if (selected.size === 0) return;
    setBulkMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      for (const id of selected) fd.append("ids", id);
      const result = await action(fd);
      setBulkMessage({ ok: result.ok, text: result.message ?? (result.ok ? "Done." : "Failed.") });
      if (result.ok) {
        setSelected(new Set());
        setConfirmDelete(false);
      }
    });
  }

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
        <div className="px-6 py-12 text-center text-sm text-muted">No users match your filter.</div>
      ) : (
        <>
          <div className="border-b border-border px-4 py-2 flex items-center gap-3 text-xs text-muted">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={allVisibleSelected}
                ref={el => {
                  if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                }}
                onChange={toggleAllVisible}
              />
              <span>
                {selected.size > 0
                  ? `${selected.size} selected`
                  : `Select all visible (${visibleSelectableIds.length})`}
              </span>
            </label>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map(r => {
              const isSelected = selected.has(r.id);
              return (
                <li
                  key={r.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 transition-colors",
                    isSelected ? "bg-primary-soft/40" : "hover:bg-accent/50",
                  )}
                >
                  <label
                    className={cn(
                      "shrink-0 cursor-pointer p-1 -m-1",
                      r.isMe && "opacity-40 cursor-not-allowed",
                    )}
                    onClick={e => {
                      if (r.isMe) e.preventDefault();
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => !r.isMe && toggle(r.id)}
                      disabled={r.isMe}
                      aria-label={`Select ${r.name}`}
                    />
                  </label>
                  <Link
                    href={`/admin/users/${r.id}`}
                    className="flex flex-1 items-center gap-4 min-w-0"
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
                        {r.twoFactorEnabled && (
                          <Badge tone="info" title="Two-factor authentication enabled">
                            <ShieldAlert className="h-3 w-3" /> 2FA
                          </Badge>
                        )}
                        {r.status === "disabled" && <Badge tone="warning">Disabled</Badge>}
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
              );
            })}
          </ul>
        </>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-0 border-t border-border bg-card px-4 py-3 shadow-[0_-6px_18px_-12px_rgba(21,16,43,0.18)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-md p-1.5 text-muted hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-foreground">
                {selected.size} selected
              </span>
              {bulkMessage && (
                <span
                  className={cn(
                    "text-xs",
                    bulkMessage.ok ? "text-success" : "text-danger",
                  )}
                >
                  · {bulkMessage.text}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => runBulk(fd => bulkUpdateStatusAction("active", { ok: false }, fd))}
              >
                <Power className="h-4 w-4" /> Reactivate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => runBulk(fd => bulkUpdateStatusAction("disabled", { ok: false }, fd))}
              >
                <Power className="h-4 w-4" /> Disable
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => runBulk(fd => bulkResetPermissionsAction({ ok: false }, fd))}
              >
                <RotateCcw className="h-4 w-4" /> Reset perms
              </Button>
              {confirmDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                  onClick={() => runBulk(fd => bulkDeleteAction({ ok: false }, fd))}
                >
                  <Trash2 className="h-4 w-4" />
                  {isPending ? "Deleting…" : `Confirm delete ${selected.size}`}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" /> Delete…
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
