import type { Dashboard } from "@/lib/dashboards/registry";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * Rendered for any dashboard whose slug is in the registry but doesn't yet
 * have a renderer wired up in `app/(portal)/dashboards/[slug]/page.tsx`.
 */
export function PlaceholderDashboard({ dashboard }: { dashboard: Dashboard }) {
  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-muted">{dashboard.category}</p>
          <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
            {dashboard.name}
          </h1>
        </div>
        <Badge tone="warning">Coming soon</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Not wired up yet</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Slug</dt>
              <dd className="mt-0.5 text-foreground font-mono text-[13px]">{dashboard.slug}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">
                Permission ID
              </dt>
              <dd className="mt-0.5 text-foreground font-mono text-[13px]">{dashboard.id}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
