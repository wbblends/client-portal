import type { Metadata } from "next";
import { SurveyFlow } from "./survey-flow";
import { listCustomers } from "@/lib/customers/registry";
import { SURVEY_TITLE } from "@/lib/survey/questions";

/**
 * Public Customer Experience Survey — lives outside the `(portal)` route
 * group, so it renders with no auth, no sidebar, no portal shell. This is the
 * link that gets emailed to customers (wbblends.app/q2-2026-survey).
 *
 * `?customerId=` is an optional attribution param: when it matches a known
 * customer the submission is tagged to that account; otherwise the response
 * is recorded against the respondent's typed name/email only.
 */
export const metadata: Metadata = {
  title: `${SURVEY_TITLE} — WB Blends`,
  description: "Tell us how WB Blends is doing. About 3 minutes.",
  robots: { index: false, follow: false },
};

export default async function Q2SurveyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp.customerId;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const known = new Set(listCustomers().map(c => c.id));
  const customerId = candidate && known.has(candidate) ? candidate : null;

  return <SurveyFlow customerId={customerId} />;
}
