import { Download } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getInvoices, INVOICE_STATUS_META } from "@/lib/data/invoices";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { paginate, parsePagination } from "@/lib/pagination";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Invoices — WB Blends" };

export default async function InvoicesPage(props: PageProps<"/invoices">) {
  const user = await requireSession();
  const sp = await props.searchParams;
  const invoices = await getInvoices(user.customerId);

  const open = invoices.filter(i => i.status === "open" || i.status === "partial");
  const overdue = invoices.filter(i => i.status === "overdue");
  const totalOpen = open.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
  const totalOverdue = overdue.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);

  // Summary tiles roll up the full account; the table itself paginates.
  const paged = paginate(invoices, parsePagination(sp));

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-display text-[34px] leading-[1.1] tracking-tight text-foreground">
          Invoices
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every invoice on your account with current payment status from our AR system. Statements
          are emailed monthly — questions can go straight to your AR contact.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryTile label="Open Balance" value={formatCurrency(totalOpen)} count={open.length} />
        <SummaryTile label="Overdue" value={formatCurrency(totalOverdue)} count={overdue.length} tone="danger" />
        <SummaryTile label="Total Invoices" value={String(invoices.length)} count={invoices.length} subtitle="Last 12 Months" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-5 py-2.5 font-semibold">Invoice</th>
                  <th className="px-3 py-2.5 font-semibold">PO</th>
                  <th className="px-3 py-2.5 font-semibold">Issue Date</th>
                  <th className="px-3 py-2.5 font-semibold">Due Date</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Amount</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Paid</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map(inv => {
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
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground-soft hover:border-border-strong hover:bg-accent transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card stack */}
          <ul className="md:hidden divide-y divide-border">
            {paged.items.map(inv => {
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
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground-soft hover:border-border-strong hover:bg-accent transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </button>
                </li>
              );
            })}
          </ul>

          <Pagination
            total={paged.total}
            page={paged.page}
            pageSize={paged.pageSize}
            itemLabel="invoices"
          />
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
