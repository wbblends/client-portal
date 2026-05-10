"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  ts: string;
  action: string;
  actor: string | null;
  target: string | null;
  targetId: string | null;
  summary: string;
};

export function AuditTable({
  rows,
  showActor = false,
}: {
  rows: Row[];
  showActor?: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      r =>
        r.summary.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        (r.actor ?? "").toLowerCase().includes(q) ||
        (r.target ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <div>
      {showActor && (
        <div className="border-b border-border px-4 py-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search actor, target, or action…"
              className="pl-9"
            />
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-muted">No events recorded yet.</div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map(r => (
            <li key={r.id} className="px-4 py-3 flex items-start gap-3">
              <div className="shrink-0 text-xs text-muted tabular-nums w-32">
                <RelativeTime ts={r.ts} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground">{r.summary}</div>
                <div className="mt-0.5 text-xs text-muted font-mono">{r.action}</div>
              </div>
              {r.targetId && r.target && (
                <Link
                  href={`/admin/users/${r.targetId}`}
                  className="shrink-0 text-xs text-primary hover:underline self-center"
                >
                  open →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RelativeTime({ ts }: { ts: string }) {
  const date = useMemo(() => new Date(ts), [ts]);
  const fallback = useMemo(
    () => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    [date],
  );
  // Computed in an effect — `Date.now()` would be an impure read during render.
  const [label, setLabel] = useState(fallback);
  useEffect(() => {
    function update() {
      const diff = Date.now() - date.getTime();
      const seconds = Math.round(diff / 1000);
      const minutes = Math.round(seconds / 60);
      const hours = Math.round(minutes / 60);
      const days = Math.round(hours / 24);
      if (seconds < 60) setLabel(`${seconds}s ago`);
      else if (minutes < 60) setLabel(`${minutes}m ago`);
      else if (hours < 24) setLabel(`${hours}h ago`);
      else if (days < 14) setLabel(`${days}d ago`);
      else setLabel(fallback);
    }
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [date, fallback]);

  return (
    <time dateTime={ts} title={date.toLocaleString()}>
      {label}
    </time>
  );
}
