import type { Dashboard } from "@/lib/dashboards/registry";
import { requireSession } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

      <Card>
        <CardHeader>
          <CardTitle>Open POs (Backlog)</CardTitle>
        </CardHeader>
        <CardContent>
          <BacklogSnapshotsChart />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open POs — last 12 weeks</CardTitle>
        </CardHeader>
        <CardContent>
          <BacklogWeeklyChart />
        </CardContent>
      </Card>
    </div>
  );
}
