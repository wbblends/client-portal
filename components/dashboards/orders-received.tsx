import type { Dashboard } from "@/lib/dashboards/registry";
import { requireSession } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { MonthlyPosReceivedChart } from "@/components/dashboard/orders-received-chart";
import type { MonthlyPosReceivedPoint } from "@/components/dashboard/orders-received-chart-impl";
import { listOrdersRows } from "@/lib/orders/store";

const ACTUALS_2025: { month: string; value: number }[] = [
  { month: "Jan", value: 4_662_705 },
  { month: "Feb", value: 5_038_802 },
  { month: "Mar", value: 6_618_716 },
  { month: "Apr", value: 7_109_174 },
  { month: "May", value: 7_068_753 },
  { month: "Jun", value: 5_725_431 },
  { month: "Jul", value: 9_589_585 },
  { month: "Aug", value: 7_111_473 },
  { month: "Sep", value: 6_037_133 },
  { month: "Oct", value: 8_733_145 },
  { month: "Nov", value: 6_998_905 },
  { month: "Dec", value: 8_376_343 },
];

const TARGETS_2026 = [
  8_135_000, 8_135_000, 8_177_000, 8_743_000, 9_293_000, 9_343_000,
  9_635_000, 9_635_000, 9_685_000, 9_685_000, 9_685_000, 9_685_000,
];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function OrdersReceivedDashboard({ dashboard }: { dashboard: Dashboard }) {
  await requireSession();

  const rows = await listOrdersRows();
  const monthlyTotals2026 = Array<number>(12).fill(0);
  for (const r of rows) {
    for (let i = 0; i < 12; i++) {
      const v = r.months[i];
      if (typeof v === "number" && Number.isFinite(v)) monthlyTotals2026[i] += v;
    }
  }

  let lastMonthWithData = -1;
  for (let i = 11; i >= 0; i--) {
    if (monthlyTotals2026[i] > 0) {
      lastMonthWithData = i;
      break;
    }
  }
  const actuals2026 =
    lastMonthWithData === -1 ? [] : monthlyTotals2026.slice(0, lastMonthWithData + 1);

  const points: MonthlyPosReceivedPoint[] = [
    ...ACTUALS_2025.map(({ month, value }) => ({
      label: `${month}-25`,
      actual: value,
      target: null,
      isYear2026: false,
    })),
    ...actuals2026.map((value, i) => ({
      label: `${MONTH_LABELS[i]}-26`,
      actual: value,
      target: TARGETS_2026[i],
      isYear2026: true,
    })),
  ];

  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-7">
      <div>
        <p className="text-sm text-muted">{dashboard.category}</p>
        <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
          {dashboard.name}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly POs Received</CardTitle>
          <CardDescription>
            Monthly PO revenue — 2025 actuals plus 2026 actuals to date, with 2026 monthly target overlay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyPosReceivedChart points={points} />
        </CardContent>
      </Card>
    </div>
  );
}
