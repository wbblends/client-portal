import type { Dashboard } from "@/lib/dashboards/registry";
import { requireSession } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  BacklogSnapshotsChart,
  BacklogWeeklyChart,
} from "@/components/dashboard/orders-backlog-charts";

export async function OrdersBacklogDashboard({ dashboard }: { dashboard: Dashboard }) {
  await requireSession();
  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-7">
      <div>
        <p className="text-sm text-muted">{dashboard.category}</p>
        <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
          {dashboard.name}
        </h1>
      </div>

      <div className="space-y-2">
        <Card>
          <CardHeader>
            <CardTitle>Open POs (Backlog)</CardTitle>
            <CardDescription>
              Open PO backlog snapshots — quarterly through 2025, then monthly. Apr-26 and May-26
              values pending.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BacklogSnapshotsChart />
          </CardContent>
        </Card>
        <p className="text-xs text-muted">
          As revenue projections increase, we need a growing backlog of open POs to continue to hit
          revenue targets.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open POs — last 12 weeks</CardTitle>
          <CardDescription>
            Weekly open-orders snapshots from the cash-flow report, Feb 16 through May 8.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BacklogWeeklyChart />
        </CardContent>
      </Card>
    </div>
  );
}
