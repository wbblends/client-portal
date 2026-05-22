"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type OpenPoEntry = {
  date: string;
  amount: number;
  updatedBy: string | null;
  updatedAt: string;
};

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/30 placeholder:text-muted-soft";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Format a YYYY-MM-DD string without going through Date (avoids TZ shifts). */
function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function OpenPoEntryCard() {
  const [entries, setEntries] = useState<OpenPoEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [date, setDate] = useState(todayIso);
  const [millions, setMillions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders-backlog/open-po")
      .then(r => r.json())
      .then(d => {
        if (!cancelled && Array.isArray(d.entries)) setEntries(d.entries);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = entries[0];

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const m = parseFloat(millions);
    if (!Number.isFinite(m) || m < 0) {
      setError("Enter the amount in millions, e.g. 33.9");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/orders-backlog/open-po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, amount: Math.round(m * 1_000_000) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save.");
        return;
      }
      const entry = data.entry as OpenPoEntry;
      setEntries(prev =>
        [entry, ...prev.filter(x => x.date !== entry.date)].sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      );
      // Let the "last 12 weeks" chart pick up the new figure without a reload.
      window.dispatchEvent(new CustomEvent("open-po:updated"));
      setMillions("");
    } catch {
      setError("Could not save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open POs — current total</CardTitle>
        <CardDescription>
          Enter the open-order total each day. The most recent entry is the working figure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-accent/30 px-4 py-3">
          {loaded && latest ? (
            <>
              <div className="font-display text-[clamp(26px,4.4vw,36px)] leading-none tracking-tight text-foreground tabular-nums">
                {formatCurrency(latest.amount, { compact: true })}
              </div>
              <div className="mt-1.5 text-xs text-muted">
                as of {prettyDate(latest.date)}
                {latest.updatedBy ? ` · recorded by ${latest.updatedBy}` : ""}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted">
              {loaded ? "No figure recorded yet — add today's total below." : "Loading…"}
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-foreground-soft mb-1">Date</span>
            <input
              type="date"
              value={date}
              max={todayIso()}
              onChange={e => setDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-foreground-soft mb-1">
              Open order amount ($ millions)
            </span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={millions}
                onChange={e => setMillions(e.target.value.replace(/[$,\s]/g, ""))}
                placeholder="33.9"
                className={`${inputCls} pl-6 pr-9 tabular-nums w-40`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                M
              </span>
            </div>
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>

        {error && <p className="text-xs text-danger">{error}</p>}

        {entries.length > 1 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Recent entries
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {entries.slice(0, 7).map(entry => (
                <li
                  key={entry.date}
                  className="flex items-center justify-between px-3 py-1.5 text-sm"
                >
                  <span className="text-foreground-soft">{prettyDate(entry.date)}</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {formatCurrency(entry.amount, { compact: true })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
