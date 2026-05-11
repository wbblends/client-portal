"use client";

import { useEffect, useRef, useState, useId } from "react";
import {
  X,
  Paperclip,
  FileText,
  Trash2,
  Plus,
  Send,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  REP_SUGGESTIONS,
  CS_SUGGESTIONS,
  PAYMENT_TERMS,
  getRepColor,
  type DeliveryRow,
  type OrderAttachment,
  type OrderDraft,
} from "@/lib/data/orders-portal";

const DRAFTS_KEY = "wbb.orders-portal.drafts.v1";

/**
 * "Enter new order" form. The structure of this form is intentionally
 * shaped after the order-intake emails the team sends to
 * orders@wbblends.com — same numbered sections (Summary, Total Revenue,
 * Payment Terms, Contacts, Customer Supplied, MISC), same delivery-schedule
 * mini-table, and a paperclip area for the PO + quote PDFs.
 *
 * Today this writes to localStorage as a draft so it survives reloads;
 * future: POST to an API that creates the corresponding Acumatica sales
 * order and emails orders@wbblends.com with the same content + attachments.
 */
export function NewOrderForm({
  open,
  onClose,
  customers,
  defaultCustomer,
  defaultRep,
  defaultCs,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  customers: string[];
  defaultCustomer?: string;
  defaultRep?: string;
  defaultCs?: string;
  /** Called after a successful submit so the parent can patch the grid. */
  onSubmit?: (draft: OrderDraft) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const [customer, setCustomer] = useState(defaultCustomer ?? "");
  const [rep, setRep] = useState(defaultRep ?? "");
  const [cs, setCs] = useState(defaultCs ?? "");
  const [poNumber, setPoNumber] = useState("");
  const [productName, setProductName] = useState("");
  const [summary, setSummary] = useState("");
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [paymentTerms, setPaymentTerms] = useState<string>("N30");
  const [contactsUnchanged, setContactsUnchanged] = useState(true);
  const [contactsNote, setContactsNote] = useState("");
  const [bottle, setBottle] = useState(false);
  const [lid, setLid] = useState(false);
  const [sticker, setSticker] = useState(false);
  const [misc, setMisc] = useState("");
  const [delivery, setDelivery] = useState<DeliveryRow[]>([]);
  const [attachments, setAttachments] = useState<OrderAttachment[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Reset form state when the modal opens fresh.
  useEffect(() => {
    if (open) {
      setSubmitted(false);
      setCustomer(defaultCustomer ?? "");
      setRep(defaultRep ?? "");
      setCs(defaultCs ?? "");
      setPoNumber("");
      setProductName("");
      setSummary("");
      setTotalRevenue(null);
      setPaymentTerms("N30");
      setContactsUnchanged(true);
      setContactsNote("");
      setBottle(false);
      setLid(false);
      setSticker(false);
      setMisc("");
      setDelivery([]);
      setAttachments([]);
    }
  }, [open, defaultCustomer, defaultRep, defaultCs]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const subject =
    customer && poNumber && productName
      ? `${customer}-${poNumber}-${productName}`
      : customer && poNumber
        ? `${customer}-${poNumber}`
        : "Auto-generated from Customer + PO + Product";

  const addDeliveryRow = () =>
    setDelivery(d => [
      ...d,
      { id: `d-${Date.now().toString(36)}-${d.length}`, weekOf: "", units: null },
    ]);

  const updateDeliveryRow = (id: string, patch: Partial<DeliveryRow>) =>
    setDelivery(d => d.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const removeDeliveryRow = (id: string) =>
    setDelivery(d => d.filter(r => r.id !== id));

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const next: OrderAttachment[] = [];
    for (const f of Array.from(files)) {
      next.push({
        id: `att-${Date.now().toString(36)}-${next.length}`,
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
      });
    }
    setAttachments(prev => [...prev, ...next]);
  };

  const removeAttachment = (id: string) =>
    setAttachments(a => a.filter(x => x.id !== id));

  const canSubmit =
    customer.trim().length > 0 &&
    rep.trim().length > 0 &&
    poNumber.trim().length > 0 &&
    summary.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const draft: OrderDraft = {
      id: `ord-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      customer: customer.trim(),
      rep: rep.trim(),
      cs: cs.trim(),
      poNumber: poNumber.trim(),
      productName: productName.trim(),
      summary: summary.trim(),
      totalRevenue,
      paymentTerms,
      contactsUnchanged,
      contactsNote: contactsNote.trim(),
      customerSuppliedBottle: bottle,
      customerSuppliedLid: lid,
      customerSuppliedSticker: sticker,
      misc: misc.trim(),
      deliverySchedule: delivery.filter(d => d.weekOf || d.units),
      attachments,
    };
    try {
      const raw = localStorage.getItem(DRAFTS_KEY);
      const list: OrderDraft[] = raw ? JSON.parse(raw) : [];
      list.unshift(draft);
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(list));
    } catch {
      // ignore quota
    }
    onSubmit?.(draft);
    setSubmitted(true);
  };

  const repTone = getRepColor(rep);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-stretch lg:items-center justify-center bg-foreground/40 backdrop-blur-sm overflow-y-auto"
      onClick={e => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="relative w-full lg:max-w-3xl my-0 lg:my-8 bg-card lg:rounded-2xl border border-border shadow-popover flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-3 border-b border-border">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">New order intake</p>
            <h2
              id={titleId}
              className="mt-1 font-display text-[24px] leading-tight tracking-tight text-foreground"
            >
              {submitted ? "Order draft saved" : "Enter New Order"}
            </h2>
            {!submitted && (
              <p className="mt-1 text-xs text-muted">
                Mirrors the structure of emails sent to{" "}
                <span className="font-mono text-foreground-soft">orders@wbblends.com</span>.
                Saves to your browser; ERP push wires up later.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 -mt-1 rounded-lg text-muted hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-10 flex flex-col items-center text-center">
            <div className="rounded-full bg-success-soft p-3">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Saved as draft
            </h3>
            <p className="mt-1 text-sm text-muted max-w-sm">
              Customer{" "}
              <span className="font-medium text-foreground-soft">{customer}</span>,{" "}
              PO <span className="font-mono text-foreground-soft">{poNumber}</span>{" "}
              has been added to your local drafts. When the Acumatica
              integration is live this will create the sales order and CC{" "}
              <span className="font-mono">orders@wbblends.com</span>.
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setSubmitted(false);
                }}
              >
                Enter another
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Body — form */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Subject preview */}
              <div className="rounded-lg border border-dashed border-border bg-accent/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted">
                  Email subject
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground truncate">
                  {subject}
                </div>
              </div>

              {/* Identity row */}
              <Section title="Account">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldCombo
                    label="Customer"
                    required
                    value={customer}
                    onChange={setCustomer}
                    options={customers}
                    placeholder="Select or type customer"
                  />
                  <Field label="PO #" required>
                    <input
                      type="text"
                      value={poNumber}
                      onChange={e => setPoNumber(e.target.value)}
                      placeholder="PO19574"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <FieldCombo
                    label="Rep"
                    required
                    value={rep}
                    onChange={setRep}
                    options={REP_SUGGESTIONS}
                    placeholder="Account rep"
                    rightAdornment={
                      rep ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            repTone.chip,
                            repTone.chipFg,
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", repTone.dot)} />
                          {rep}
                        </span>
                      ) : null
                    }
                  />
                  <FieldCombo
                    label="Customer Success"
                    value={cs}
                    onChange={setCs}
                    options={CS_SUGGESTIONS}
                    placeholder="CS owner"
                  />
                </div>
                <div className="mt-3">
                  <Field label="Product / Item">
                    <input
                      type="text"
                      value={productName}
                      onChange={e => setProductName(e.target.value)}
                      placeholder="e.g. Testosterone Support (New Formula)"
                      className={inputCls}
                    />
                  </Field>
                </div>
              </Section>

              {/* 1. Summary */}
              <Section title="1. Summary" required>
                <textarea
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  rows={2}
                  placeholder="Please see attached reorder for…"
                  className={cn(inputCls, "min-h-[64px] resize-y")}
                />
              </Section>

              {/* 2 & 3. Revenue + Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Section title="2. Total Revenue">
                  <CurrencyInput value={totalRevenue} onChange={setTotalRevenue} />
                </Section>
                <Section title="3. Payment Terms">
                  <Select
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                  >
                    {PAYMENT_TERMS.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Section>
              </div>

              {/* 4. Contacts */}
              <Section title="4. Contacts">
                <div className="flex items-center gap-4 text-sm">
                  <RadioRow
                    name="contacts"
                    checked={contactsUnchanged}
                    onChange={() => setContactsUnchanged(true)}
                    label="Unchanged"
                  />
                  <RadioRow
                    name="contacts"
                    checked={!contactsUnchanged}
                    onChange={() => setContactsUnchanged(false)}
                    label="Update / new"
                  />
                </div>
                {!contactsUnchanged && (
                  <textarea
                    value={contactsNote}
                    onChange={e => setContactsNote(e.target.value)}
                    rows={2}
                    placeholder="New point of contact, email, phone…"
                    className={cn(inputCls, "mt-2 min-h-[56px] resize-y")}
                  />
                )}
              </Section>

              {/* 5. Customer Supplied */}
              <Section title="5. Customer Supplied">
                <div className="flex flex-wrap gap-2">
                  <Toggle label="Bottle" checked={bottle} onChange={setBottle} />
                  <Toggle label="Lid" checked={lid} onChange={setLid} />
                  <Toggle label="Sticker" checked={sticker} onChange={setSticker} />
                </div>
              </Section>

              {/* 6. MISC */}
              <Section title="6. MISC">
                <textarea
                  value={misc}
                  onChange={e => setMisc(e.target.value)}
                  rows={2}
                  placeholder="Anything else the team should know…"
                  className={cn(inputCls, "min-h-[60px] resize-y")}
                />
              </Section>

              {/* Delivery schedule */}
              <Section title="Delivery schedule">
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-accent/40 text-[11px] uppercase tracking-wide text-muted">
                        <th className="text-left px-3 py-2 font-semibold">Week of</th>
                        <th className="text-right px-3 py-2 font-semibold">Units</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {delivery.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 py-4 text-center text-xs text-muted-soft"
                          >
                            No rows yet. Add weekly drops below if applicable.
                          </td>
                        </tr>
                      ) : (
                        delivery.map(d => (
                          <tr key={d.id} className="border-t border-border/60">
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={d.weekOf}
                                onChange={e => updateDeliveryRow(d.id, { weekOf: e.target.value })}
                                placeholder="7/27"
                                className="w-full bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary/40 rounded px-1 py-1 text-foreground"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={d.units == null ? "" : String(d.units)}
                                onChange={e => {
                                  const cleaned = e.target.value.replace(/[,\s]/g, "");
                                  if (cleaned === "") {
                                    updateDeliveryRow(d.id, { units: null });
                                  } else {
                                    const n = Number(cleaned);
                                    updateDeliveryRow(d.id, {
                                      units: Number.isFinite(n) ? n : null,
                                    });
                                  }
                                }}
                                placeholder="46,800"
                                className="w-full bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary/40 rounded px-1 py-1 text-right tabular-nums text-foreground"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeDeliveryRow(d.id)}
                                className="p-1 rounded text-muted-soft hover:text-danger hover:bg-danger-soft transition-colors"
                                aria-label="Remove row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={addDeliveryRow}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover"
                >
                  <Plus className="h-3.5 w-3.5" /> Add week
                </button>
              </Section>

              {/* Attachments */}
              <Section title="Attachments">
                <FileDrop onFiles={onPickFiles}>
                  <Paperclip className="h-5 w-5 text-muted" />
                  <div className="text-sm text-foreground-soft font-medium">
                    Drop PO + quote PDFs, or click to browse
                  </div>
                  <div className="text-xs text-muted">
                    Anything you'd normally attach to the order intake email
                  </div>
                </FileDrop>

                {attachments.length > 0 && (
                  <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                    {attachments.map(a => (
                      <li
                        key={a.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <FileText className="h-4 w-4 text-muted shrink-0" />
                        <span className="flex-1 truncate text-foreground">
                          {a.name}
                        </span>
                        <span className="text-xs text-muted tabular-nums">
                          {fmtSize(a.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          className="p-1 rounded text-muted-soft hover:text-danger hover:bg-danger-soft transition-colors"
                          aria-label={`Remove ${a.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-accent/20">
              <div className="text-xs text-muted">
                {canSubmit ? (
                  <>Required fields complete. </>
                ) : (
                  <>
                    Required: Customer, Rep, PO #, Summary
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                  <Send className="h-3.5 w-3.5" />
                  Submit order
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Subparts ------------------------------- */

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/30 placeholder:text-muted-soft";

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-soft">
          {title}
        </h3>
        {required && <span className="text-danger text-xs">*</span>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-foreground-soft mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function FieldCombo({
  label,
  required,
  value,
  onChange,
  options,
  placeholder,
  rightAdornment,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  rightAdornment?: React.ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} required={required}>
      <div className="relative">
        <input
          type="text"
          list={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(inputCls, rightAdornment && "pr-24")}
        />
        {rightAdornment && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {rightAdornment}
          </div>
        )}
        <datalist id={id}>
          {options.map(o => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </div>
    </Field>
  );
}

function CurrencyInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value == null ? "" : String(value)}
        onChange={e => {
          const cleaned = e.target.value.replace(/[$,\s]/g, "");
          if (cleaned === "") {
            onChange(null);
          } else {
            const n = Number(cleaned);
            onChange(Number.isFinite(n) ? n : null);
          }
        }}
        placeholder="3,010,000"
        className={cn(inputCls, "pl-6 tabular-nums")}
      />
    </div>
  );
}

function RadioRow({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-[var(--color-primary)]"
      />
      <span className="text-foreground-soft">{label}</span>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        checked
          ? "bg-primary-soft border-primary/30 text-primary"
          : "bg-card border-border text-foreground-soft hover:border-border-strong",
      )}
    >
      <span
        className={cn(
          "h-3.5 w-3.5 rounded-full border flex items-center justify-center transition-colors",
          checked ? "bg-primary border-primary" : "border-border-strong",
        )}
      >
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
      </span>
      {label}
    </button>
  );
}

function FileDrop({
  onFiles,
  children,
}: {
  onFiles: (files: FileList | null) => void;
  children: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={e => {
        e.preventDefault();
        setHover(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center cursor-pointer transition-colors",
        hover
          ? "border-primary bg-primary-soft/40"
          : "border-border-strong bg-accent/20 hover:bg-accent/40",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => onFiles(e.target.files)}
      />
      {children}
    </div>
  );
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
