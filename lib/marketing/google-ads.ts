/**
 * Google Ads spend.
 *
 * Stubbed — fill in once Devin's Google Ads developer token is approved.
 *
 * Auth (when ready):
 *   - GOOGLE_ADS_DEVELOPER_TOKEN — apply via Google Ads Manager → Tools → API Center
 *   - GOOGLE_ADS_CLIENT_ID + GOOGLE_ADS_CLIENT_SECRET — OAuth2 desktop app
 *   - GOOGLE_ADS_REFRESH_TOKEN — captured via one-time consent flow
 *   - GOOGLE_ADS_CUSTOMER_ID — the account ID (no dashes)
 *   - GOOGLE_ADS_LOGIN_CUSTOMER_ID — manager account ID, if querying through one
 *
 * Once the token's approved, replace getAdSpend with a GAQL query like:
 *
 *   SELECT metrics.cost_micros
 *   FROM customer
 *   WHERE segments.date DURING <date range>
 *
 * (cost_micros / 1_000_000 = dollars)
 */

export type AdSpendStats = {
  source: "live" | "placeholder";
  last7d: number;
  last30d: number;
  mtd: number;
};

const PLACEHOLDER: AdSpendStats = {
  source: "placeholder",
  last7d: 1_240,
  last30d: 5_180,
  mtd: 1_460,
};

function hasCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_CUSTOMER_ID,
  );
}

export async function getGoogleAdSpend(): Promise<AdSpendStats> {
  if (!hasCredentials()) return PLACEHOLDER;
  // TODO: real Google Ads API call once developer token is approved.
  return PLACEHOLDER;
}
