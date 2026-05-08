import { seededRng } from "@/lib/utils";
import type { Invoice, InvoiceStatus } from "./types";

/**
 * Mock invoice list. Future: pull from Acumatica AR Invoices, joined with
 * payment status from the proprietary AR system.
 */
export async function getInvoices(customerId: string): Promise<Invoice[]> {
  const rng = seededRng(hash(customerId) ^ 0xa53c1b);
  const today = new Date();
  const list: Invoice[] = [];
  for (let i = 0; i < 32; i++) {
    const issue = new Date(today);
    issue.setDate(issue.getDate() - Math.floor(rng() * 365));
    const due = new Date(issue);
    due.setDate(due.getDate() + 30);
    const amount = Math.round((1500 + rng() * 28500) * 100) / 100;
    const ageDays = Math.floor((today.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24));
    let status: InvoiceStatus;
    let paid = 0;
    if (ageDays < 8) {
      status = rng() < 0.3 ? "draft" : "open";
    } else if (ageDays < 30) {
      status = rng() < 0.65 ? "open" : (rng() < 0.5 ? "partial" : "paid");
      if (status === "partial") paid = Math.round(amount * (0.2 + rng() * 0.5) * 100) / 100;
      if (status === "paid") paid = amount;
    } else if (ageDays < 45) {
      const r = rng();
      if (r < 0.7) { status = "paid"; paid = amount; }
      else if (r < 0.85) { status = "overdue"; }
      else { status = "partial"; paid = Math.round(amount * 0.5 * 100) / 100; }
    } else {
      status = "paid";
      paid = amount;
    }
    list.push({
      id: `inv-${i}`,
      number: `INV-2026-${String(2400 + i).padStart(5, "0")}`,
      poNumber: `PO-${100000 + 1000 + i}`,
      issueDate: issue,
      dueDate: due,
      amount,
      paidAmount: paid,
      status,
    });
  }
  return list.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
}

export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  paid: { label: "Paid", tone: "success" },
  open: { label: "Open", tone: "info" },
  overdue: { label: "Overdue", tone: "danger" },
  partial: { label: "Partial", tone: "warning" },
  draft: { label: "Draft", tone: "neutral" },
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}
