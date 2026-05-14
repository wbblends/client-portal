import type { Customer } from "@/lib/customers/registry";
import { getCustomerProfile } from "@/lib/data/customer";
import { computeOnTimeRate, getAllOrders, getOrdersInRange } from "@/lib/data/orders";
import { resolveRange, getCompareRange } from "@/lib/data/range";
import {
  buildBuckets,
  pickBucketing,
  pctChange,
  sumOrders,
  sumOrdersInBucket,
} from "@/lib/data/aggregate";
import { getOpenOrders } from "@/lib/data/open-orders";
import { getOnboardingProducts } from "@/lib/data/onboarding";
import { buildSalesByProduct } from "@/lib/data/sales-products";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { SalesByDurationChart } from "@/components/dashboard/yoy-chart";
import { SkuGrid } from "@/components/dashboard/sku-grid";
import { SalesByProduct } from "@/components/dashboard/sales-by-product";
import { OpenOrdersReport } from "@/components/dashboard/open-orders-report";
import { OnboardingReport } from "@/components/dashboard/onboarding-report";
import { formatCurrency, formatNumber } from "@/lib/utils";

/**
 * Renderer for the per-customer overview dashboard. Server component.
 * The `customer` is the URL-scoped customer being viewed; `viewerName` is
 * the logged-in user's display name (used for the greeting only).
 */
export async function CustomerOverviewDashboard({
  customer,
  viewerName,
  searchParams,
}: {
  customer: Customer;
  viewerName: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const range = resolveRange(searchParams);
  const compare = getCompareRange(range);

  const [profile, currentOrders, priorOrders, allOrders, openOrders, onboarding] =
    await Promise.all([
      getCustomerProfile(customer.id),
      getOrdersInRange(customer.id, range.from, range.to),
      getOrdersInRange(customer.id, compare.from, compare.to),
      getAllOrders(customer.id),
      getOpenOrders(customer.id),
      getOnboardingProducts(customer.id),
    ]);

  const cur = sumOrders(currentOrders);
  const prev = sumOrders(priorOrders);
  const onTime = computeOnTimeRate(currentOrders);
  const onTimePrior = computeOnTimeRate(priorOrders);

  const bucketMode = pickBucketing(range.from, range.to);
  const buckets = buildBuckets(range.from, range.to, bucketMode);
  const priorBuckets = buildBuckets(compare.from, compare.to, bucketMode);

  const yoyDollars = buckets.map((b, i) => {
    const c = sumOrdersInBucket(allOrders, b);
    const p = priorBuckets[i] ? sumOrdersInBucket(allOrders, priorBuckets[i]) : { dollars: 0, units: 0 };
    return { bucket: b.label, current: Math.round(c.dollars), prior: Math.round(p.dollars) };
  });
  const yoyUnits = buckets.map((b, i) => {
    const c = sumOrdersInBucket(allOrders, b);
    const p = priorBuckets[i] ? sumOrdersInBucket(allOrders, priorBuckets[i]) : { dollars: 0, units: 0 };
    return { bucket: b.label, current: c.units, prior: p.units };
  });

  const productRows = buildSalesByProduct(
    allOrders,
    { from: range.from, to: range.to },
    { from: compare.from, to: compare.to },
    5,
  );

  const today = new Date();
  const reportDate = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(2)}`;

  return (
    <div className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted">Welcome back, {viewerName.split(" ")[0]}.</p>
          <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground break-words">
            {profile.name}
          </h1>
        </div>
        <DateRangePicker from={range.from} to={range.to} presetId={range.presetId} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiTile
          label="Order Value"
          value={formatCurrency(cur.dollars)}
          delta={pctChange(cur.dollars, prev.dollars)}
          hint={`vs ${formatCurrency(prev.dollars, { compact: true })} ${compare.shortLabel}`}
        />
        <KpiTile
          label="Units Ordered"
          value={formatNumber(cur.units)}
          delta={pctChange(cur.units, prev.units)}
          hint={`vs ${formatNumber(prev.units, { compact: true })} ${compare.shortLabel}`}
        />
        <KpiTile
          label="Orders Placed"
          value={formatNumber(cur.count)}
          delta={pctChange(cur.count, prev.count)}
          hint={`vs ${prev.count} ${compare.shortLabel}`}
        />
        <KpiTile
          label="On-Time Delivery"
          value={`${onTime.toFixed(1)}%`}
          delta={pctChange(onTime, onTimePrior)}
          hint={onTimePrior ? `vs ${onTimePrior.toFixed(1)}% ${compare.shortLabel}` : undefined}
          preferDirection="up"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales By Duration</CardTitle>
          <CardDescription>
            Your selected window vs. {compare.label.toLowerCase()}. Toggle between dollars and
            units.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SalesByDurationChart
            data={yoyDollars}
            unitsData={yoyUnits}
            compareLabel={compare.label}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-[clamp(20px,2.6vw,24px)] leading-tight tracking-tight text-foreground">
            Sales By Product
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Your top five products by trailing-12-month volume. Selected and compare windows
            adjust as you change the date picker.
          </p>
        </div>
        <SalesByProduct
          rows={productRows}
          currentLabel="Selected Window"
          compareLabel={compare.label}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-[clamp(20px,2.6vw,24px)] leading-tight tracking-tight text-foreground">
            Onboarding Statuses
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Every SKU we&apos;re commercializing with you — quoting, R&amp;D, pilot, and FPS review.
            Once a product hits production, it rolls into Open Orders below.
          </p>
        </div>
        <OnboardingReport
          products={onboarding}
          reportDate={reportDate}
          customerName={profile.name}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-[clamp(20px,2.6vw,24px)] leading-tight tracking-tight text-foreground">
            Open Orders
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Your standing weekly Friday status — promise dates, current production stage, and any
            flags. No black boxes.
          </p>
        </div>
        <OpenOrdersReport
          orders={openOrders}
          reportDate={reportDate}
          customerName={profile.name}
          salesRep="Priya Patel"
          accountManager="Jordan Reyes"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Historical Orders</CardTitle>
          <CardDescription>
            Your top 7 SKUs by value in the selected window. Units and value adjust with the date
            picker; the cadence and order window on the right are estimates from your account
            team.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <SkuGrid orders={currentOrders} topN={7} />
        </CardContent>
      </Card>
    </div>
  );
}
