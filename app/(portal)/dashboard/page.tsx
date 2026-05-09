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
import { getOpenOrders, ON_TRACK_META, type OpenOrder } from "@/lib/data/open-orders";
import {
  getOnboardingProducts,
  ONBOARDING_STAGE_META,
  type OnboardingProduct,
} from "@/lib/data/onboarding";
import { buildSalesByProduct } from "@/lib/data/sales-products";
import {
  parseSearchParam,
  parseMultiParam,
  matchesAny,
  compareBy,
} from "@/lib/filters";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { SalesByDurationChart } from "@/components/dashboard/yoy-chart";
import { SkuGrid } from "@/components/dashboard/sku-grid";
import { SalesByProduct } from "@/components/dashboard/sales-by-product";
import { OpenOrdersReport } from "@/components/dashboard/open-orders-report";
import { OnboardingReport } from "@/components/dashboard/onboarding-report";
import { FilterBar } from "@/components/ui/filter-bar";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";

export const metadata = { title: "Dashboard — WB Blends" };

const OPEN_ORDER_SORT_OPTIONS = [
  { value: "ship-asc", label: "Est. Ship (soonest)" },
  { value: "ship-desc", label: "Est. Ship (latest)" },
  { value: "qty-desc", label: "Quantity (high to low)" },
  { value: "qty-asc", label: "Quantity (low to high)" },
  { value: "po-asc", label: "PO Number" },
];

const OPEN_ORDER_TYPE_OPTIONS = [
  { value: "Capsules", label: "Capsules" },
  { value: "Powders", label: "Powders" },
  { value: "Liquids", label: "Liquids" },
];

const OPEN_ORDER_TRACK_OPTIONS = (Object.keys(ON_TRACK_META) as Array<keyof typeof ON_TRACK_META>).map(
  k => ({ value: k, label: ON_TRACK_META[k].label }),
);

const ONBOARDING_SORT_OPTIONS = [
  { value: "updated-desc", label: "Last Update (newest)" },
  { value: "updated-asc", label: "Last Update (oldest)" },
  { value: "product-asc", label: "Product (A → Z)" },
  { value: "product-desc", label: "Product (Z → A)" },
];

const ONBOARDING_STAGE_OPTIONS = (
  Object.keys(ONBOARDING_STAGE_META) as Array<keyof typeof ONBOARDING_STAGE_META>
).map(k => ({ value: k, label: k }));

const ONBOARDING_FORMAT_OPTIONS = [
  { value: "Capsules", label: "Capsules" },
  { value: "Powders", label: "Powders" },
  { value: "Liquids", label: "Liquids" },
];

/** Parse "M/D/YY" into a comparable timestamp. The dashboard reports store
 *  dates as pre-formatted strings rather than Date objects. */
function parseShortDate(s: string): number {
  const [m, d, y] = s.split("/").map(n => parseInt(n, 10));
  if (!m || !d || y == null) return 0;
  const yyyy = y < 100 ? 2000 + y : y;
  return new Date(yyyy, m - 1, d).getTime();
}

function resolveOpenOrderField(o: OpenOrder, field: string) {
  switch (field) {
    case "qty":
      return o.quantity;
    case "po":
      return o.poNumber;
    case "ship":
    default:
      return parseShortDate(o.estimatedShipDate);
  }
}

function resolveOnboardingField(p: OnboardingProduct, field: string) {
  switch (field) {
    case "product":
      return p.productName.toLowerCase();
    case "updated":
    default:
      return parseShortDate(p.lastUpdated);
  }
}

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const user = await requireSession();
  const sp = await props.searchParams;
  const range = resolveRange(sp);
  const compare = getCompareRange(range);

  const [profile, currentOrders, priorOrders, allOrders, openOrdersAll, onboardingAll] =
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

  // Open Orders filtering — namespaced URL params so multiple bars on the
  // dashboard don't fight over the same keys.
  const ooQ = parseSearchParam(sp.oo_q).toLowerCase();
  const ooTypes = parseMultiParam(sp.oo_type);
  const ooTracks = parseMultiParam(sp.oo_track);
  const ooSort = parseSearchParam(sp.oo_sort) || "ship-asc";

  let openOrders = openOrdersAll;
  if (ooQ) {
    openOrders = openOrders.filter(
      o =>
        o.poNumber.toLowerCase().includes(ooQ) ||
        o.salesOrder.toLowerCase().includes(ooQ) ||
        o.productName.toLowerCase().includes(ooQ),
    );
  }
  if (ooTypes.length) openOrders = openOrders.filter(o => matchesAny(o.type, ooTypes));
  if (ooTracks.length) openOrders = openOrders.filter(o => matchesAny(o.onTrack, ooTracks));
  openOrders = [...openOrders].sort(compareBy(ooSort, resolveOpenOrderField));

  // Onboarding filtering
  const obQ = parseSearchParam(sp.ob_q).toLowerCase();
  const obStages = parseMultiParam(sp.ob_stage);
  const obFormats = parseMultiParam(sp.ob_format);
  const obSort = parseSearchParam(sp.ob_sort) || "updated-desc";

  let onboarding = onboardingAll;
  if (obQ) {
    onboarding = onboarding.filter(
      p =>
        p.productName.toLowerCase().includes(obQ) ||
        p.sku.toLowerCase().includes(obQ),
    );
  }
  if (obStages.length) onboarding = onboarding.filter(p => matchesAny(p.stage, obStages));
  if (obFormats.length) onboarding = onboarding.filter(p => matchesAny(p.format, obFormats));
  onboarding = [...onboarding].sort(compareBy(obSort, resolveOnboardingField));

  const today = new Date();
  const reportDate = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(2)}`;

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
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-[24px] leading-tight tracking-tight text-foreground">
            Onboarding Statuses
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Every SKU we&apos;re commercializing with you — quoting, R&amp;D, pilot, and FPS review.
            Once a product hits production, it rolls into Open Orders below.
            {onboarding.length !== onboardingAll.length && (
              <>
                {" "}
                <span className="text-foreground-soft font-medium">
                  Showing {onboarding.length} of {onboardingAll.length}.
                </span>
              </>
            )}
          </p>
        </div>
        <FilterBar
          searchParam="ob_q"
          searchPlaceholder="Search SKU or product…"
          filterGroups={[
            { param: "ob_stage", label: "Stage", options: ONBOARDING_STAGE_OPTIONS },
            { param: "ob_format", label: "Format", options: ONBOARDING_FORMAT_OPTIONS },
          ]}
          sort={{
            param: "ob_sort",
            options: ONBOARDING_SORT_OPTIONS,
            defaultValue: "updated-desc",
          }}
        />
        <OnboardingReport
          products={onboarding}
          reportDate={reportDate}
          customerName={profile.name}
        />
      </section>

      {/* Open Orders — same data the customer success team sends every Friday */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-[24px] leading-tight tracking-tight text-foreground">
            Open Orders
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Your standing weekly Friday status — promise dates, current production stage, and any
            flags. No black boxes.
            {openOrders.length !== openOrdersAll.length && (
              <>
                {" "}
                <span className="text-foreground-soft font-medium">
                  Showing {openOrders.length} of {openOrdersAll.length}.
                </span>
              </>
            )}
          </p>
        </div>
        <FilterBar
          searchParam="oo_q"
          searchPlaceholder="Search PO, SO, or product…"
          filterGroups={[
            { param: "oo_track", label: "On Track", options: OPEN_ORDER_TRACK_OPTIONS },
            { param: "oo_type", label: "Type", options: OPEN_ORDER_TYPE_OPTIONS },
          ]}
          sort={{
            param: "oo_sort",
            options: OPEN_ORDER_SORT_OPTIONS,
            defaultValue: "ship-asc",
          }}
        />
        <OpenOrdersReport
          orders={openOrders}
          reportDate={reportDate}
          customerName={profile.name}
          salesRep="Priya Patel"
          accountManager="Jordan Reyes"
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
