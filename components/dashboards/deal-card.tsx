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

export function CompanyLogo({ domain, name }: { domain: string; name: string | null }) {
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
 *  HubSpot notes for the deal, and lets the user edit tier/format/amount with
 *  changes written back to HubSpot. */
export function DealCardView({
  deal,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  deal: DealCard;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLButtonElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  // Card-level state for the editable fields so the kanban tile reflects edits
  // made in the modal without waiting for the next page revalidation.
  const [tier, setTier] = useState<DealTier | null>(deal.tier);
  const [format, setFormat] = useState<DealFormat | null>(deal.format);
  const [amount, setAmount] = useState<number>(deal.amount);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`text-left w-full block rounded-lg bg-card border border-border px-3 py-2.5 shadow-[var(--shadow-card)] hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
          draggable ? "cursor-grab active:cursor-grabbing" : ""
        } ${isDragging ? "opacity-40" : ""}`}
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
          {deal.owner && (
            <OwnerAvatar
              name={deal.owner.name}
              initials={deal.owner.initials}
              avatarUrl={deal.owner.avatarUrl ?? null}
            />
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="font-semibold text-foreground tabular-nums text-[14px]">
            {fmtMoneyCompact(amount)}
          </span>
          <span className="text-[11px] text-muted tabular-nums">
            {formatCloseDate(deal.closeDate, deal.monthExpected)}
          </span>
        </div>

        {(tier || format || deal.productCategory) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {tier && (
              <Badge tone={TIER_TONE[tier]} className="px-1.5 py-0 text-[10px]">
                Tier {tier}
              </Badge>
            )}
            {format && (
              <span className="inline-flex items-center gap-1 text-[10px] text-foreground-soft bg-surface border border-border rounded-md px-1.5 py-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${FORMAT_DOT[format]}`} />
                {format}
              </span>
            )}
            {!format && deal.productCategory && (
              <span className="inline-flex items-center text-[10px] text-foreground-soft bg-surface border border-border rounded-md px-1.5 py-0.5">
                {deal.productCategory}
              </span>
            )}
          </div>
        )}
      </button>

      {open && (
        <DealNotesModal
          deal={deal}
          tier={tier}
          format={format}
          amount={amount}
          onChange={(next) => {
            if (next.tier !== undefined) setTier(next.tier);
            if (next.format !== undefined) setFormat(next.format);
            if (next.amount !== undefined) setAmount(next.amount);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

type ModalChange = {
  tier?: DealTier | null;
  format?: DealFormat | null;
  amount?: number;
};

export function DealNotesModal({
  deal,
  tier,
  format,
  amount,
  onChange,
  onClose,
}: {
  deal: DealCard;
  tier: DealTier | null;
  format: DealFormat | null;
  amount: number;
  onChange: (next: ModalChange) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<DealNote[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Editor state
  const [amountDraft, setAmountDraft] = useState<string>(String(Math.round(amount)));
  const [savingField, setSavingField] = useState<null | "tier" | "format" | "amount">(null);
  const [editError, setEditError] = useState<string | null>(null);

  async function patchDeal(patch: ModalChange, label: "tier" | "format" | "amount") {
    setSavingField(label);
    setEditError(null);
    try {
      const res = await fetch(`/api/marketing/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Failed to update ${label} (${res.status})`);
      }
      const data = (await res.json()) as {
        tier: DealTier | null;
        format: DealFormat | null;
        amount: number;
      };
      onChange({ tier: data.tier, format: data.format, amount: data.amount });
      if (label === "amount") setAmountDraft(String(Math.round(data.amount)));
    } catch (err) {
      setEditError(err instanceof Error ? err.message : `Failed to update ${label}`);
    } finally {
      setSavingField(null);
    }
  }

  function onTierChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    const next: DealTier | null =
      v === "AA" || v === "A" || v === "B" || v === "C" ? v : null;
    onChange({ tier: next });
    void patchDeal({ tier: next }, "tier");
  }

  function onFormatChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    const next: DealFormat | null =
      v === "Liquid" || v === "Capsule" || v === "Powder" ? v : null;
    onChange({ format: next });
    void patchDeal({ format: next }, "format");
  }

  function commitAmount() {
    const cleaned = amountDraft.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n < 0) {
      setEditError("Amount must be a positive number");
      setAmountDraft(String(Math.round(amount)));
      return;
    }
    if (Math.round(n) === Math.round(amount)) return;
    void patchDeal({ amount: n }, "amount");
  }

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

        <div className="px-5 py-3 border-b border-border bg-surface/40">
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              Tier
              <select
                value={tier ?? ""}
                onChange={onTierChange}
                disabled={savingField !== null}
                className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 disabled:opacity-60"
              >
                <option value="">—</option>
                <option value="AA">AA</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              Format
              <select
                value={format ?? ""}
                onChange={onFormatChange}
                disabled={savingField !== null}
                className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 disabled:opacity-60"
              >
                <option value="">—</option>
                <option value="Liquid">Liquid</option>
                <option value="Capsule">Capsule</option>
                <option value="Powder">Powder</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              Deal value
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted text-sm">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountDraft}
                  onChange={e => setAmountDraft(e.target.value)}
                  onBlur={commitAmount}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  disabled={savingField !== null}
                  className="w-full rounded-md border border-border bg-card pl-5 pr-2 py-1.5 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 disabled:opacity-60"
                />
              </div>
            </label>
          </div>
          <div className="mt-1.5 min-h-[16px] text-[11px]">
            {savingField && <span className="text-muted">Saving {savingField}…</span>}
            {!savingField && editError && <span className="text-danger">{editError}</span>}
          </div>
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

function OwnerAvatar({
  name,
  initials,
  avatarUrl,
}: {
  name: string;
  initials: string;
  avatarUrl: string | null;
}) {
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        title={name}
        onError={() => setFailed(true)}
        loading="lazy"
        className="shrink-0 h-6 w-6 rounded-full object-cover ring-1 ring-border bg-surface"
      />
    );
  }
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
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    // Whole millions render as $2mm; otherwise one decimal: $2.5mm.
    return `$${Number.isInteger(m) ? m : m.toFixed(1)}mm`;
  }
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
