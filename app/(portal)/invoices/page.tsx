import { Download } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getInvoices, INVOICE_STATUS_META } from "@/lib/data/invoices";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Invoices — WB Blends" };

export default async function InvoicesPage() {
  const user = await requireSession();
  const invoices = await getInvoices(user.customerId);

  const open = invoices.filter(i => i.status === "open" || i.status === "partial");
  const overdue = invoices.filter(i => i.status === "overdue");
  const totalOpen = open.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
  const totalOverdue = overdue.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground">
          Invoices
        </h1>
        <p className="mt-2 text-base text-foreground-soft leading-relaxed max-w-3xl">
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
            <table className="w-full text-base">
              <thead className="text-left text-xs font-bold uppercase tracking-wide text-muted">
                <tr className="border-b-2 border-border-strong">
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-3 py-3">PO</th>
                  <th className="px-3 py-3">Issue Date</th>
                  <th className="px-3 py-3">Due Date</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="px-3 py-3 text-right">Paid</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const meta = INVOICE_STATUS_META[inv.status];
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="font-mono text-sm text-muted">{inv.number}</div>
                      </td>
                      <td className="px-3 py-4 align-top text-foreground-soft">
                        {inv.poNumber ?? "—"}
                      </td>
                      <td className="px-3 py-4 align-top text-foreground-soft">
                        {formatDate(inv.issueDate)}
                      </td>
                      <td className="px-3 py-4 align-top text-foreground-soft">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="px-3 py-4 align-top text-right tabular-nums font-semibold">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td className="px-3 py-4 align-top text-right tabular-nums text-foreground-soft">
                        {formatCurrency(inv.paidAmount)}
                      </td>
                      <td className="px-3 py-4 align-top">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <button
                          type="button"
                          aria-label={`Download invoice ${inv.number} PDF`}
                          className="inline-flex items-center gap-2 rounded-md border-2 border-border-strong px-3 py-2 text-sm font-semibold text-foreground hover:border-primary hover:bg-accent transition-colors"
                        >
                          <Download className="h-4 w-4" aria-hidden />
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
            {invoices.map(inv => {
              const meta = INVOICE_STATUS_META[inv.status];
              return (
                <li key={inv.id} className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-base text-foreground-soft font-semibold">{inv.number}</div>
                      {inv.poNumber && (
                        <div className="font-mono text-sm text-muted mt-1">
                          {inv.poNumber}
                        </div>
                      )}
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-base">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-muted">Issued</div>
                      <div className="text-foreground-soft tabular-nums mt-0.5">{formatDate(inv.issueDate, "short")}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-muted">Due</div>
                      <div className="text-foreground-soft tabular-nums mt-0.5">{formatDate(inv.dueDate, "short")}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-muted">Amount</div>
                      <div className="tabular-nums font-bold text-foreground mt-0.5">{formatCurrency(inv.amount)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-muted">Paid</div>
                      <div className="tabular-nums text-foreground-soft mt-0.5">{formatCurrency(inv.paidAmount)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Download invoice ${inv.number} PDF`}
                    className="mt-4 inline-flex items-center gap-2 rounded-md border-2 border-border-strong px-4 py-2.5 text-base font-semibold text-foreground hover:border-primary hover:bg-accent transition-colors"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    PDF
                  </button>
                </li>
              );
            })}
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
    <div className="rounded-xl border border-border bg-card px-6 py-5 shadow-[var(--shadow-card)]">
      <div className="text-base font-semibold text-foreground-soft">{label}</div>
      <div className={`mt-2 text-4xl font-bold tracking-tight tabular-nums ${tone === "danger" ? "text-danger" : "text-foreground"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm text-muted">
        {subtitle ?? `${count} invoice${count === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}
