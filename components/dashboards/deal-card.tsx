"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DealCard, DealTier, DealFormat, DealNote } from "@/lib/marketing/hubspot";

const MAX_NOTE_LEN = 4000;
// HubSpot notes are stored as HTML; the client only sends plain text and the
// server wraps it before posting.

const TIER_TONE: Record<DealTier, BadgeTone> = {
  AA: "info",
  A: "success",
  B: "warning",
  C: "neutral",
};

const FORMAT_DOT: Record<DealFormat, string> = {
  Liquid: "bg-info",
  Capsule: "bg-primary",
  Powder: "bg-warning",
};

function CompanyLogo({ domain, name }: { domain: string; name: string | null }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`}
      alt={name ? `${name} logo` : ""}
      onError={() => setFailed(true)}
      loading="lazy"
      className="shrink-0 h-6 w-6 rounded bg-surface border border-border object-contain"
    />
  );
}

/** Client-side deal card. Renders the same visual as the original server-only
 *  card but, on click, opens a modal that fetches and shows the 5 most recent
 *  HubSpot notes for the deal. */
export function DealCardView({ deal }: { deal: DealCard }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left w-full block rounded-lg bg-card border border-border px-3 py-2.5 shadow-[var(--shadow-card)] hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {deal.companyDomain && (
              <CompanyLogo domain={deal.companyDomain} name={deal.companyName} />
            )}
            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-medium text-foreground leading-snug line-clamp-2"
                title={deal.name}
              >
                {deal.name}
              </div>
              {deal.companyName && deal.companyName !== deal.name && (
                <div className="mt-0.5 text-[11px] text-muted truncate" title={deal.companyName}>
                  {deal.companyName}
                </div>
              )}
            </div>
          </div>
          {deal.owner && <OwnerAvatar name={deal.owner.name} initials={deal.owner.initials} />}
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="font-semibold text-foreground tabular-nums text-[14px]">
            {fmtMoneyCompact(deal.amount)}
          </span>
          <span className="text-[11px] text-muted tabular-nums">
            {formatCloseDate(deal.closeDate, deal.monthExpected)}
          </span>
        </div>

        {(deal.tier || deal.format || deal.productCategory) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {deal.tier && (
              <Badge tone={TIER_TONE[deal.tier]} className="px-1.5 py-0 text-[10px]">
                Tier {deal.tier}
              </Badge>
            )}
            {deal.format && (
              <span className="inline-flex items-center gap-1 text-[10px] text-foreground-soft bg-surface border border-border rounded-md px-1.5 py-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${FORMAT_DOT[deal.format]}`} />
                {deal.format}
              </span>
            )}
            {!deal.format && deal.productCategory && (
              <span className="inline-flex items-center text-[10px] text-foreground-soft bg-surface border border-border rounded-md px-1.5 py-0.5">
                {deal.productCategory}
              </span>
            )}
          </div>
        )}
      </button>

      {open && <DealNotesModal deal={deal} onClose={() => setOpen(false)} />}
    </>
  );
}

function DealNotesModal({ deal, onClose }: { deal: DealCard; onClose: () => void }) {
  const [notes, setNotes] = useState<DealNote[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/marketing/deals/${deal.id}/notes`, { signal: ac.signal })
      .then(async r => {
        if (!r.ok) throw new Error(`Failed to load notes (${r.status})`);
        return (await r.json()) as { notes: DealNote[] };
      })
      .then(data => setNotes(data.notes))
      .catch(err => {
        if (err.name !== "AbortError") setLoadError(err.message || "Failed to load notes");
      });
    return () => ac.abort();
  }, [deal.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  async function submitNote() {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/marketing/deals/${deal.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Failed to post note (${res.status})`);
      }
      const data = (await res.json()) as { note: DealNote | null };
      if (data.note) {
        setNotes(prev => [data.note as DealNote, ...(prev ?? [])].slice(0, 5));
      }
      setDraft("");
      textareaRef.current?.focus();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to post note");
    } finally {
      setSubmitting(false);
    }
  }

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submitNote();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => !submitting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Recent notes for ${deal.name}`}
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-xl bg-card border border-border shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Recent notes
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground tracking-tight truncate">
              {deal.name}
            </h2>
            {deal.companyName && deal.companyName !== deal.name && (
              <p className="text-xs text-muted truncate">{deal.companyName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 -mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {notes === null && loadError === null && <NotesSkeleton />}
          {loadError && <p className="text-sm text-danger">{loadError}</p>}
          {notes && notes.length === 0 && (
            <p className="text-sm text-muted">No notes on this deal yet.</p>
          )}
          {notes && notes.length > 0 && (
            <ul className="space-y-3">
              {notes.map(n => (
                <li
                  key={n.id}
                  className="rounded-lg border border-border bg-surface/50 px-3.5 py-3"
                >
                  <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
                    <span className="font-medium text-foreground-soft">
                      {n.owner?.name ?? "—"}
                    </span>
                    <span className="tabular-nums">{formatNoteTime(n.timestamp)}</span>
                  </div>
                  <div className="mt-1.5 text-sm text-foreground whitespace-pre-wrap break-words">
                    {n.body || <span className="text-muted italic">(empty note)</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 space-y-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onTextareaKeyDown}
            disabled={submitting}
            placeholder="Add a note… (⌘/Ctrl + Enter to post)"
            maxLength={MAX_NOTE_LEN}
            rows={3}
            className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 disabled:opacity-60"
          />
          {submitError && <p className="text-xs text-danger">{submitError}</p>}
          <div className="flex items-center justify-between gap-3">
            <a
              href={deal.hubspotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              Open in HubSpot
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted tabular-nums">
                {draft.length}/{MAX_NOTE_LEN}
              </span>
              <Button
                size="sm"
                onClick={submitNote}
                disabled={submitting || draft.trim().length === 0}
              >
                {submitting ? "Posting…" : "Post note"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotesSkeleton() {
  return (
    <ul className="space-y-3">
      {[0, 1, 2].map(i => (
        <li
          key={i}
          className="rounded-lg border border-border bg-surface/50 px-3.5 py-3 animate-pulse"
        >
          <div className="h-3 w-32 rounded bg-border" />
          <div className="mt-2 h-3 w-full rounded bg-border" />
          <div className="mt-1.5 h-3 w-4/5 rounded bg-border" />
        </li>
      ))}
    </ul>
  );
}

function OwnerAvatar({ name, initials }: { name: string; initials: string }) {
  return (
    <div
      title={name}
      className="shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[10px] font-semibold tabular-nums"
    >
      {initials.slice(0, 2)}
    </div>
  );
}

function fmtMoneyCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatCloseDate(iso: string | null, monthExpected: string | null): string {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }
  if (monthExpected) return monthExpected.slice(0, 3);
  return "—";
}

function formatNoteTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
