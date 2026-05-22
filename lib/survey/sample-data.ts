/**
 * Deterministic placeholder responses for the Customer Feedback admin page.
 *
 * Shown only when the `survey_responses` table is empty, so the charts and
 * tables have something realistic to render before real submissions arrive.
 * A banner on the page makes clear the data is sample data. Generated with a
 * seeded RNG so the numbers are stable across reloads (no hydration drift).
 */
import { seededRng, hashString } from "@/lib/utils";
import {
  QUESTIONS,
  NPS_QUESTION,
  SURVEY_KEY,
  type SurveyResponse,
} from "./questions";

type Persona = {
  first: string;
  last: string;
  email: string;
  customerId: string | null;
  /** -0.6..+0.6 — shifts this respondent's whole scorecard up or down. */
  mood: number;
};

const PERSONAS: Persona[] = [
  { first: "Marcus", last: "Bell", email: "marcus@designsforhealth.com", customerId: "designs-for-health", mood: 0.5 },
  { first: "Priya", last: "Anand", email: "priya@goldenhippo.com", customerId: "golden-hippo", mood: 0.2 },
  { first: "Devon", last: "Clarke", email: "devon@nativepath.com", customerId: "native-path", mood: -0.4 },
  { first: "Sara", last: "Linwood", email: "sara@thorne.com", customerId: "thorne", mood: 0.6 },
  { first: "Hector", last: "Ramos", email: "hector@silverfernbrand.com", customerId: "silver-fern", mood: 0.1 },
  { first: "Jenna", last: "Powell", email: "jenna@justingredients.us", customerId: "just-ingredients", mood: 0.4 },
  { first: "Aaron", last: "Whitfield", email: "aaron@bioptimizers.com", customerId: "bioptimizer", mood: -0.5 },
  { first: "Mei", last: "Tran", email: "mei@sportsresearch.com", customerId: "sports-research", mood: 0.3 },
  { first: "Cole", last: "Barrett", email: "cole@snapsupplements.com", customerId: "snap", mood: -0.2 },
  { first: "Olivia", last: "Hahn", email: "olivia@kilo.health", customerId: "kilo-health", mood: 0.5 },
  { first: "Trent", last: "Mosely", email: "trent@veracityselfcare.com", customerId: "veracity", mood: 0.0 },
  { first: "Bianca", last: "Reyes", email: "bianca@cleannutraceuticals.com", customerId: "clean-nutraceuticals", mood: 0.3 },
  { first: "Garrett", last: "Doyle", email: "garrett@brightleaf.co", customerId: null, mood: -0.6 },
  { first: "Nadia", last: "Forsythe", email: "nadia@purefieldlabs.com", customerId: null, mood: 0.4 },
];

/** Per-question baseline quality (1–5), keyed by question id. Deliberately
 *  uneven so the "average rating by question" chart has a story — lead times
 *  read lower, formulation support and product quality read higher. */
const QUESTION_BASELINE: Record<string, number> = {
  q2: 3.8, q3: 4.6, q4: 4.0,
  q5: 3.2, q6: 4.2, q7: 3.7, q8: 4.4, q9: 4.3, q10: 3.9,
  q12: 4.7, q13: 4.4, q14: 3.9, q15: 4.5, q16: 4.1, q17: 3.6,
  q18: 3.5, q19: 3.8, q20: 4.2,
  q21: 4.4, // likelihood to continue
};

const LOW_COMMENTS = [
  "Lead times slipped twice this quarter — we had to delay a launch.",
  "Pricing keeps creeping and the quotes aren't easy to compare.",
  "Documentation for our Amazon listing came back later than promised.",
  "MOQ on the powder line is higher than we'd like for a test run.",
  "Had to chase a few status updates that should have been proactive.",
];
const HIGH_COMMENTS = [
  "Formulation team caught an ingredient issue before it cost us. Huge.",
  "Batch-to-batch consistency has been flawless all year.",
  "Our account manager actually answers the phone. Rare.",
  "Quality is the reason we haven't shopped around.",
  "Onboarding our second SKU was painless compared to other CMs.",
];
const CHANGE_ONE = [
  "Tighten lead times — even a week earlier changes our launch calendar.",
  "A self-serve quote portal so we can model pricing without the back-and-forth.",
  "Lower MOQs on first production runs for new formulas.",
  "Faster turnaround on COAs and compliance docs.",
  "More proactive updates when something on a PO shifts.",
];
const UPCOMING = [
  "Two new gummy SKUs targeting a Q4 launch.",
  "Scaling our flagship capsule — looking at doubling monthly volume.",
  "A liquid line extension we'd like help formulating.",
  "Amazon-ready packaging refresh across the catalog.",
];

/** Builds the full set of sample responses. Stable for a given module load. */
export function sampleSurveyResponses(): SurveyResponse[] {
  const out: SurveyResponse[] = [];
  const now = Date.now();

  PERSONAS.forEach((p, idx) => {
    const rng = seededRng(hashString(p.email));
    const ratings: Record<string, number> = {};
    const comments: Record<string, string> = {};

    for (const q of QUESTIONS) {
      if (q.scale === "nps") continue; // handled below
      const base = (QUESTION_BASELINE[q.id] ?? 4.0) + p.mood;
      const noise = (rng() - 0.5) * 2.0;
      const value = Math.min(5, Math.max(1, Math.round(base + noise)));
      ratings[q.id] = value;

      // Attach a comment to a minority of answers — biased toward the
      // extremes, since that's where respondents bother to explain.
      if (rng() < 0.16) {
        if (value <= 2) {
          comments[q.id] = LOW_COMMENTS[Math.floor(rng() * LOW_COMMENTS.length)];
        } else if (value >= 5) {
          comments[q.id] = HIGH_COMMENTS[Math.floor(rng() * HIGH_COMMENTS.length)];
        }
      }
    }

    // NPS — correlated with overall mood, kept on the 1–10 scale.
    const npsBase = 7.6 + p.mood * 3;
    ratings[NPS_QUESTION.id] = Math.min(
      10,
      Math.max(1, Math.round(npsBase + (rng() - 0.5) * 2)),
    );

    const submittedAt = new Date(
      now - (idx * 26 + Math.floor(rng() * 20)) * 60 * 60 * 1000,
    ).toISOString();

    out.push({
      id: `sample-${idx + 1}`,
      surveyKey: SURVEY_KEY,
      respondentId: `sample-${idx + 1}`,
      firstName: p.first,
      lastName: p.last,
      email: p.email,
      customerId: p.customerId,
      ratings,
      comments,
      changeOne: CHANGE_ONE[idx % CHANGE_ONE.length],
      upcoming: UPCOMING[idx % UPCOMING.length],
      submittedAt,
    });
  });

  return out;
}
