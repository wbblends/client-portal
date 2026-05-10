/**
 * Account Penetration — internal sales view.
 *
 * For each customer that has a closed-won deal in the main sales pipeline, the
 * thermometer width = the expected annual value committed when that deal
 * closed. The thermometer fills with deals from the Account Expansion pipeline:
 *   - Closed-won expansion deals = full saturation (already shipping).
 *   - In-flight expansion deals = progressively lighter bands by stage
 *     (Onboarding → Quoting → R&D, lightest).
 *   - Anything left over = white space (still-to-sell capacity).
 *
 * Data flows through the HubSpot client stub (lib/hubspot/*). With no creds,
 * fixtures return so the UI is reviewable. Drop in HUBSPOT_PRIVATE_APP_TOKEN
 * and the same loaders hit the real API — the page above doesn't change.
 */

import {
  getSalesPipelineClosedWon,
  getExpansionDeals,
  type Deal,
} from "@/lib/hubspot/deals";
import { getCompaniesByIds, type Company } from "@/lib/hubspot/companies";
import {
  getSalesAndExpansionPipelines,
  STAGE_BUCKETS,
  type StageBucket,
  type Pipeline,
  type PipelineStage,
} from "@/lib/hubspot/pipelines";

export type ThermometerSegment = {
  bucket: StageBucket;
  /** Human-readable stage label collected from member deals. */
  label: string;
  value: number;
  dealCount: number;
};

export type AccountPenetrationRow = {
  companyId: string;
  companyName: string;
  industry?: string;
  /** Width of the thermometer — projected annual run-rate at account-close. */
  expectedAnnualValue: number;
  /** Date the original sales-pipeline deal closed. */
  accountClosedDate: Date | null;
  /** Per-bucket totals, ordered earliest → latest. Always length = STAGE_BUCKETS.length. */
  segments: ThermometerSegment[];
  /** Sum of closed-won expansion deals — what's already shipping. */
  filledValue: number;
  /** Sum of all in-flight (non-closed) expansion deals. */
  inFlightValue: number;
  /** Unsold capacity below expectedAnnualValue. Min 0. */
  whiteSpaceValue: number;
  /** All expansion deals tied to this account, sorted by value desc. */
  expansionDeals: Deal[];
};

export type AccountPenetrationSummary = {
  accounts: AccountPenetrationRow[];
  totals: {
    expectedAnnualValue: number;
    filledValue: number;
    inFlightValue: number;
    whiteSpaceValue: number;
  };
  /** Most recent close date across the surfaced accounts (for the "synced as of" hint). */
  asOf: Date;
  /** True when running on mock fixtures because HUBSPOT_PRIVATE_APP_TOKEN is unset. */
  usingMockData: boolean;
};

export async function getAccountPenetration(): Promise<AccountPenetrationSummary> {
  const [closedWonAccounts, expansionDeals, pipelines] = await Promise.all([
    getSalesPipelineClosedWon(),
    getExpansionDeals(),
    getSalesAndExpansionPipelines(),
  ]);

  const companyIds = new Set<string>();
  for (const d of closedWonAccounts) if (d.companyId) companyIds.add(d.companyId);
  for (const d of expansionDeals) if (d.companyId) companyIds.add(d.companyId);
  const companies = await getCompaniesByIds(Array.from(companyIds));

  const expansionByCompany = groupBy(expansionDeals, d => d.companyId ?? "");

  const accounts: AccountPenetrationRow[] = closedWonAccounts
    .filter(d => d.companyId)
    .map(salesDeal =>
      buildRow(
        salesDeal,
        expansionByCompany.get(salesDeal.companyId!) ?? [],
        companies.get(salesDeal.companyId!),
        pipelines.expansion,
      ),
    )
    .sort((a, b) => b.expectedAnnualValue - a.expectedAnnualValue);

  const totals = accounts.reduce(
    (acc, r) => {
      acc.expectedAnnualValue += r.expectedAnnualValue;
      acc.filledValue += r.filledValue;
      acc.inFlightValue += r.inFlightValue;
      acc.whiteSpaceValue += r.whiteSpaceValue;
      return acc;
    },
    { expectedAnnualValue: 0, filledValue: 0, inFlightValue: 0, whiteSpaceValue: 0 },
  );

  const closeTimestamps = accounts
    .map(a => a.accountClosedDate?.getTime())
    .filter((n): n is number => typeof n === "number");
  const asOf = closeTimestamps.length
    ? new Date(Math.max(...closeTimestamps))
    : new Date();

  return {
    accounts,
    totals,
    asOf,
    usingMockData: !process.env.HUBSPOT_PRIVATE_APP_TOKEN,
  };
}

function buildRow(
  salesDeal: Deal,
  expansion: Deal[],
  company: Company | undefined,
  expansionPipeline: Pipeline | null,
): AccountPenetrationRow {
  const stageById = new Map<string, PipelineStage>();
  if (expansionPipeline) for (const s of expansionPipeline.stages) stageById.set(s.id, s);

  // Group by bucket and accumulate value + a representative label per bucket.
  const segMap = new Map<StageBucket, ThermometerSegment>();
  for (const bucket of STAGE_BUCKETS) {
    segMap.set(bucket, { bucket, label: defaultLabelFor(bucket), value: 0, dealCount: 0 });
  }
  for (const d of expansion) {
    const stage = stageById.get(d.stageId);
    const bucket = stage?.bucket ?? "rnd";
    const seg = segMap.get(bucket)!;
    seg.value += d.expectedAnnualValue;
    seg.dealCount += 1;
    if (stage?.label) seg.label = stage.label;
  }

  const segments = STAGE_BUCKETS.map(b => segMap.get(b)!);
  const filledValue = segMap.get("closed_won")!.value;
  const inFlightValue =
    segMap.get("onboarding")!.value +
    segMap.get("quoting")!.value +
    segMap.get("rnd")!.value;
  const whiteSpaceValue = Math.max(
    0,
    salesDeal.expectedAnnualValue - filledValue - inFlightValue,
  );

  return {
    companyId: salesDeal.companyId!,
    companyName: company?.name ?? salesDeal.name,
    industry: company?.industry,
    expectedAnnualValue: salesDeal.expectedAnnualValue,
    accountClosedDate: salesDeal.closedDate,
    segments,
    filledValue,
    inFlightValue,
    whiteSpaceValue,
    expansionDeals: [...expansion].sort((a, b) => b.expectedAnnualValue - a.expectedAnnualValue),
  };
}

function defaultLabelFor(bucket: StageBucket): string {
  switch (bucket) {
    case "closed_won": return "Closed Won";
    case "onboarding": return "Onboarding";
    case "quoting":    return "Quoting";
    case "rnd":        return "R&D";
  }
}

function groupBy<T, K>(items: T[], keyFn: (t: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const it of items) {
    const k = keyFn(it);
    const arr = out.get(k);
    if (arr) arr.push(it);
    else out.set(k, [it]);
  }
  return out;
}
