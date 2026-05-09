import { requireSession } from "@/lib/auth";
import { getCustomerProfile } from "@/lib/data/customer";
import { getAllOrders, getOrdersInRange } from "@/lib/data/orders";
import { computeOnTimeRate } from "@/lib/data/market";
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
import { Pagination } from "@/components/ui/pagination";
import { paginate, parsePagination } from "@/lib/pagination";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { SalesByDurationChart } from "@/components/dashboard/yoy-chart";
import { SkuGrid } from "@/components/dashboard/sku-grid";
import { SalesByProduct } from "@/components/dashboard/sales-by-product";
import { OpenOrdersReport } from "@/components/dashboard/open-orders-report";
import { OnboardingReport } from "@/components/dashboard/onboarding-report";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";

export const metadata = { title: "Dashboard — WB Blends" };

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const user = await requireSession();
  const sp = await props.searchParams;
  const range = resolveRange(sp);
  const compare = getCompareRange(range);

  const [profile, currentOrders, priorOrders, allOrders, openOrders, onboarding] =
    await Promise.all([
      getCustomerProfile(user.customerId),
      getOrdersInRange(user.customerId, range.from, range.to),
      getOrdersInRange(user.customerId, compare.from, compare.to),
      getAllOrders(user.customerId),
      getOpenOrders(user.customerId),
      getOnboardingProducts(user.customerId),
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

  // Two paginated reports share this page, so each owns its own param namespace.
  // Default to 10 rows on the dashboard — these are widgets, not full list pages.
  const openOrdersPaged = paginate(
    openOrders,
    parsePagination(sp, { pageParam: "ooPage", sizeParam: "ooSize", defaultPageSize: 10 }),
  );
  const onboardingPaged = paginate(
    onboarding,
    parsePagination(sp, { pageParam: "obPage", sizeParam: "obSize", defaultPageSize: 10 }),
  );

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto space-y-7">
      {/* Page header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted">Welcome back, {user.name.split(" ")[0]}.</p>
          <h1 className="mt-0.5 font-display text-[34px] leading-[1.1] tracking-tight text-foreground">
            {profile.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Customer #{profile.id} · Account Since {profile.accountSince} · Showing{" "}
            <span className="text-foreground-soft font-medium">
              {formatDate(range.from, "short")} – {formatDate(range.to, "short")}
            </span>
          </p>
        </div>
        <DateRangePicker from={range.from} to={range.to} presetId={range.presetId} />
      </div>

      {/* KPIs — compare hint adapts to the selected window */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Sales By Duration — bar chart, current vs the same kind of compare window */}
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

      {/* Sales By Product — top 5 products with annual + current + compare */}
      <section className="space-y-2">
        <div>
          <h2 className="font-display text-[24px] leading-tight tracking-tight text-foreground">
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

      {/* Onboarding Statuses — first per the brand's commercialization process */}
      <section className="space-y-2">
        <div>
          <h2 className="font-display text-[24px] leading-tight tracking-tight text-foreground">
            Onboarding Statuses
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Every SKU we&apos;re commercializing with you — quoting, R&amp;D, pilot, and FPS review.
            Once a product hits production, it rolls into Open Orders below.
          </p>
        </div>
        <OnboardingReport
          products={onboardingPaged.items}
          reportDate={reportDate}
          customerName={profile.name}
          footer={
            <Pagination
              total={onboardingPaged.total}
              page={onboardingPaged.page}
              pageSize={onboardingPaged.pageSize}
              pageParam="obPage"
              sizeParam="obSize"
              itemLabel="products"
            />
          }
        />
      </section>

      {/* Open Orders — same data the customer success team sends every Friday */}
      <section className="space-y-2">
        <div>
          <h2 className="font-display text-[24px] leading-tight tracking-tight text-foreground">
            Open Orders
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Your standing weekly Friday status — promise dates, current production stage, and any
            flags. No black boxes.
          </p>
        </div>
        <OpenOrdersReport
          orders={openOrdersPaged.items}
          reportDate={reportDate}
          customerName={profile.name}
          salesRep="Priya Patel"
          accountManager="Jordan Reyes"
          footer={
            <Pagination
              total={openOrdersPaged.total}
              page={openOrdersPaged.page}
              pageSize={openOrdersPaged.pageSize}
              pageParam="ooPage"
              sizeParam="ooSize"
              itemLabel="orders"
            />
          }
        />
      </section>

      {/* Historical Orders — left half is dynamic with the date picker (units +
          value); right half is static reorder cadence estimated by your sales team. */}
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
