import { requireCustomerAccess } from "@/lib/auth";
import { getInvoices, INVOICE_STATUS_META } from "@/lib/data/invoices";
import type { InvoiceStatus } from "@/lib/data/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FilterBar } from "@/components/filters/filter-bar";
import { SortableHeader } from "@/components/filters/sortable-header";
import { readEnum, readSort, readString } from "@/lib/filters/url-state";
import { applyEnumEquals, applySort, applyTextSearch } from "@/lib/filters/apply";

export const metadata = { title: "Invoices — WB Blends" };

const SORTABLE_COLUMNS = ["number", "po", "issueDate", "dueDate", "amount", "paid", "status"] as const;
const STATUSES: InvoiceStatus[] = ["paid", "open", "overdue", "partial", "draft"];

export default async function InvoicesPage(props: PageProps<"/c/[customerId]/invoices">) {
  const { customerId } = await props.params;
  const { customer } = await requireCustomerAccess(customerId);
  const sp = await props.searchParams;

  const all = await getInvoices(customer.id);

  // Summary tiles always reflect the customer's full book — filters only
  // affect the table below so totals stay meaningful even mid-filter.
  const open = all.filter(i => i.status === "open" || i.status === "partial");
  const overdue = all.filter(i => i.status === "overdue");
  const totalOpen = open.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
  const totalOverdue = overdue.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);

  const query = readString(sp, "q");
  const status = readEnum<InvoiceStatus>(sp, "status", STATUSES);
  const sort = readSort(sp, SORTABLE_COLUMNS, { column: "issueDate", direction: "desc" });

  let invoices = applyTextSearch(all, query, [i => i.number, i => i.poNumber]);
  invoices = applyEnumEquals(invoices, status, i => i.status);
  invoices = applySort(
    invoices,
    i => {
      switch (sort.column) {
        case "number":
          return i.number;
        case "po":
          return i.poNumber ?? null;
        case "issueDate":
          return i.issueDate;
        case "dueDate":
          return i.dueDate;
        case "amount":
          return i.amount;
        case "paid":
          return i.paidAmount;
        case "status":
          return i.status;
      }
    },
    sort.direction,
  );

  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-6">
      <div>
        <p className="text-sm text-muted">{customer.name}</p>
        <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
          Invoices
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every invoice on your account with current payment status from our AR system. Statements
          are emailed monthly — questions can go straight to your AR contact.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <SummaryTile label="Open Balance" value={formatCurrency(totalOpen)} count={open.length} />
        <SummaryTile label="Overdue" value={formatCurrency(totalOverdue)} count={overdue.length} tone="danger" />
        <SummaryTile label="Total Invoices" value={String(all.length)} count={all.length} subtitle="Last 12 Months" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>
            {invoices.length === all.length
              ? "Most recent first."
              : `Showing ${invoices.length} of ${all.length} invoices.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-0">
          <div className="px-4 sm:px-5">
            <FilterBar
              search={{ param: "q", placeholder: "Search invoice or PO number…" }}
              selects={[
                {
                  kind: "select",
                  param: "status",
                  label: "Status",
                  options: [
                    { value: "", label: "All statuses" },
                    ...STATUSES.map(s => ({ value: s, label: INVOICE_STATUS_META[s].label })),
                  ],
                },
              ]}
            />
          </div>

          {/* Desktop table — header sticks to the page so long invoice lists
              keep column context as you scroll. Wrapper deliberately omits
              vertical overflow so `position: sticky` resolves against the
              page (or the lg sidebar's `top-0`) rather than the wrapper. */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card text-left text-[11px] font-semibold uppercase tracking-wide text-muted shadow-[0_1px_0_0_var(--color-border)]">
                <tr>
                  <SortableHeader column="number" label="Invoice" className="px-5 py-2.5" />
                  <SortableHeader column="po" label="PO" className="px-3 py-2.5" />
                  <SortableHeader column="issueDate" label="Issue Date" className="px-3 py-2.5" defaultDirection="desc" />
                  <SortableHeader column="dueDate" label="Due Date" className="px-3 py-2.5" defaultDirection="desc" />
                  <SortableHeader column="amount" label="Amount" className="px-3 py-2.5 text-right" align="right" defaultDirection="desc" />
                  <SortableHeader column="paid" label="Paid" className="px-3 py-2.5 text-right" align="right" defaultDirection="desc" />
                  <SortableHeader column="status" label="Status" className="px-3 py-2.5" />
                  <th scope="col" className="px-5 py-2.5 font-semibold sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted">
                      No invoices match the current filters.
                    </td>
                  </tr>
                ) : invoices.map(inv => {
                  const meta = INVOICE_STATUS_META[inv.status];
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors"
                    >
                      <td className="px-5 py-3 align-top">
                        <div className="font-mono text-[12px] text-muted">{inv.number}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-foreground-soft">
                        {inv.poNumber ?? "—"}
                      </td>
                      <td className="px-3 py-3 align-top text-foreground-soft">
                        {formatDate(inv.issueDate)}
                      </td>
                      <td className="px-3 py-3 align-top text-foreground-soft">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="px-3 py-3 align-top text-right tabular-nums font-medium">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td className="px-3 py-3 align-top text-right tabular-nums text-foreground-soft">
                        {formatCurrency(inv.paidAmount)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="px-5 py-3 align-top">
                        {/* PDF download is not built yet — small badge instead
                            of a dead disabled button so the column reads as
                            "feature pending" rather than broken. */}
                        <span
                          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-soft"
                          aria-label="PDF download coming soon"
                        >
                          PDF soon
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card stack */}
          <ul className="md:hidden divide-y divide-border">
            {invoices.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted">
                No invoices match the current filters.
              </li>
            ) : invoices.map(inv => {
              const meta = INVOICE_STATUS_META[inv.status];
              return (
                <li key={inv.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] text-muted">{inv.number}</div>
                      {inv.poNumber && (
                        <div className="font-mono text-[11px] text-muted-soft mt-0.5">
                          {inv.poNumber}
                        </div>
                      )}
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted">Issued</div>
                      <div className="text-foreground-soft tabular-nums">{formatDate(inv.issueDate, "short")}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted">Due</div>
                      <div className="text-foreground-soft tabular-nums">{formatDate(inv.dueDate, "short")}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted">Amount</div>
                      <div className="tabular-nums font-medium text-foreground">{formatCurrency(inv.amount)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted">Paid</div>
                      <div className="tabular-nums text-foreground-soft">{formatCurrency(inv.paidAmount)}</div>
                    </div>
                  </div>
                  <span
                    className="mt-3 inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-soft"
                    aria-label="PDF download coming soon"
                  >
                    PDF soon
                  </span>
                </li>
              );
            })
            }
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  count,
  subtitle,
  tone = "neutral",
}: {
  label: string;
  value: string;
  count: number;
  subtitle?: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div className={`mt-1.5 text-[26px] font-semibold tracking-tight tabular-nums ${tone === "danger" ? "text-danger" : "text-foreground"}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted">
        {subtitle ?? `${count} invoice${count === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}
