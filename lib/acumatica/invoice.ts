/**
 * Acumatica AR Invoice / SalesInvoice entity.
 *
 * Endpoint: /entity/Default/{version}/SalesInvoice
 * Composite key: Type + ReferenceNbr.
 *
 * Note on the customer field:
 *   - SalesOrder uses `CustomerID`.
 *   - SalesInvoice uses `Customer` (no ID suffix). Verify on your tenant
 *     swagger; some endpoint customizations rename it.
 */

import type { Invoice, InvoiceStatus } from "@/lib/data/types";
import { entityUrl, getAcumaticaConfig } from "./config";
import { getList, request } from "./client";
import { andFilter, odataDate, odataQuery, odataString, parseAcumaticaDate, v } from "./utils";
import type { EntityEnvelope, Field } from "./types";

export type AcumaticaInvoice = EntityEnvelope & {
  Type: Field<"Invoice" | "Credit Memo" | "Debit Memo" | "Cash Sale" | string>;
  ReferenceNbr: Field<string>;
  Customer: Field<string>;
  CustomerOrder: Field<string>; // PO number
  Date: Field<string>;
  DueDate: Field<string>;
  Status: Field<"Open" | "Closed" | "Pending Print" | "On Hold" | "Voided" | "Scheduled" | string>;
  Amount: Field<number>;
  Balance: Field<number>;
  Description: Field<string>;
};

const FIELDS = [
  "Type", "ReferenceNbr", "Customer", "CustomerOrder", "Date",
  "DueDate", "Status", "Amount", "Balance", "Description",
];

export type FetchInvoicesParams = {
  customerId: string;
  dateFrom?: Date;
  dateTo?: Date;
  openOnly?: boolean;
};

export async function fetchInvoices(params: FetchInvoicesParams): Promise<AcumaticaInvoice[]> {
  const cfg = getAcumaticaConfig();
  const filter = andFilter(
    `Customer eq ${odataString(params.customerId)}`,
    params.dateFrom && `Date ge ${odataDate(params.dateFrom)}`,
    params.dateTo && `Date le ${odataDate(params.dateTo)}`,
    params.openOnly && `Status eq 'Open'`,
  );
  const qs = odataQuery({ filter, select: FIELDS, orderby: "Date desc" });
  return getList<AcumaticaInvoice>(entityUrl(cfg, `SalesInvoice${qs}`));
}

export async function fetchInvoice(type: string, referenceNbr: string): Promise<AcumaticaInvoice> {
  const cfg = getAcumaticaConfig();
  const url = entityUrl(
    cfg,
    `SalesInvoice/${encodeURIComponent(type)}/${encodeURIComponent(referenceNbr)}`,
  );
  return request<AcumaticaInvoice>(url);
}

export function toInvoice(a: AcumaticaInvoice): Invoice {
  const amount = v(a.Amount) ?? 0;
  const balance = v(a.Balance) ?? 0;
  const issueDate = parseAcumaticaDate(v(a.Date)) ?? new Date();
  const dueDate = parseAcumaticaDate(v(a.DueDate)) ?? issueDate;
  return {
    id: `${v(a.Type)}-${v(a.ReferenceNbr)}`,
    number: v(a.ReferenceNbr) ?? "",
    poNumber: v(a.CustomerOrder) ?? undefined,
    issueDate,
    dueDate,
    amount,
    paidAmount: Math.max(0, amount - balance),
    status: mapStatus(v(a.Status), amount, balance, dueDate),
  };
}

function mapStatus(s: string | null, amount: number, balance: number, dueDate: Date): InvoiceStatus {
  if (s === "Scheduled" || s === "Pending Print") return "draft";
  if (s === "Closed" || balance <= 0) return "paid";
  if (balance > 0 && balance < amount) return "partial";
  if (s === "Open" && dueDate.getTime() < Date.now()) return "overdue";
  return "open";
}
