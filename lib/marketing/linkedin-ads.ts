/**
 * LinkedIn ad spend.
 *
 * Strategy: skip the Marketing Developer Platform API (1–3 weeks of approval
 * back-and-forth with LinkedIn) and feed this from a daily CSV export from
 * Campaign Manager.
 *
 * Setup:
 *   1. In Campaign Manager → Reporting, create a "Daily spend" scheduled report
 *   2. Configure it to deliver as CSV to a OneDrive folder (or have it emailed
 *      and a Power Automate flow drop it into the folder)
 *   3. Set LINKEDIN_CSV_DIR to the absolute path of that folder
 *
 * The reader scans CSVs in that directory and aggregates by date. Schema is
 * assumed to include a "Date" and "Amount Spent (USD)" column — adjust
 * COLUMN_DATE / COLUMN_SPEND below to match your actual export.
 */

import type { AdSpendStats } from "./google-ads";

const PLACEHOLDER: AdSpendStats = {
  source: "placeholder",
  last7d: 890,
  last30d: 3_420,
  mtd: 980,
};

export async function getLinkedInAdSpend(): Promise<AdSpendStats> {
  if (!process.env.LINKEDIN_CSV_DIR) return PLACEHOLDER;
  // TODO: read + parse CSVs in LINKEDIN_CSV_DIR, sum by date range.
  return PLACEHOLDER;
}
