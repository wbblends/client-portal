/**
 * WB Blends Customer Experience Survey — question set, scales, and screen copy.
 *
 * Single source of truth shared by the public survey flow
 * (`app/q2-2026-survey/`) and the admin results page
 * (`app/(portal)/admin/customer-feedback/`) so both render the same question
 * text, the same scale endpoints, and the same number of work screens.
 *
 * Built to the WB-Blends-Survey-Handoff spec: 5 sections, 22 rating questions
 * (Q1–Q21 on a 1–5 scale, Q22 on the 1–10 NPS scale), 2 optional free-text
 * questions. Question order follows the customer lifecycle — quoting →
 * service → product → growth → outlook — so adjacent questions don't bias
 * each other.
 */

/** Identifier for the current survey wave. Stored on every response row so a
 *  future quarter can ship as a new key without colliding with this one. */
export const SURVEY_KEY = "q2-2026";
export const SURVEY_TITLE = "Customer Experience Survey";

/** Soft cap on every free-text field. The UI shows a counter past 1,800. */
export const FREE_TEXT_MAX = 2000;
export const FREE_TEXT_COUNTER_AT = 1800;

// ─── Scales ────────────────────────────────────────────────────────────────

export type RatingScaleId = "satisfaction" | "likelihood" | "nps";

export type ScaleOption = { value: number; label: string };

export type RatingScale = {
  id: RatingScaleId;
  min: number;
  max: number;
  /** End-of-scale labels shown at the extremes of the rating row. */
  minLabel: string;
  maxLabel: string;
  options: ScaleOption[];
};

export const SCALES: Record<RatingScaleId, RatingScale> = {
  // Q1–Q20 — clinical satisfaction wording, kept neutral per the handoff.
  satisfaction: {
    id: "satisfaction",
    min: 1,
    max: 5,
    minLabel: "Very Unsatisfied",
    maxLabel: "Very Satisfied",
    options: [
      { value: 1, label: "Very Unsatisfied" },
      { value: 2, label: "Unsatisfied" },
      { value: 3, label: "Neutral" },
      { value: 4, label: "Satisfied" },
      { value: 5, label: "Very Satisfied" },
    ],
  },
  // Q21 — likelihood to continue the partnership.
  likelihood: {
    id: "likelihood",
    min: 1,
    max: 5,
    minLabel: "Very Unlikely",
    maxLabel: "Very Likely",
    options: [
      { value: 1, label: "Very Unlikely" },
      { value: 2, label: "Unlikely" },
      { value: 3, label: "Neutral" },
      { value: 4, label: "Likely" },
      { value: 5, label: "Very Likely" },
    ],
  },
  // Q22 — true NPS scale, kept at 1–10 (not collapsed to 1–5) so the result
  // is comparable to standard NPS benchmarks.
  nps: {
    id: "nps",
    min: 1,
    max: 10,
    minLabel: "Not Likely",
    maxLabel: "Extremely Likely",
    options: Array.from({ length: 10 }, (_, i) => ({
      value: i + 1,
      label:
        i === 0 ? "Not Likely" : i === 9 ? "Extremely Likely" : String(i + 1),
    })),
  },
};

// ─── Sections ──────────────────────────────────────────────────────────────

export type SurveySection = {
  number: number;
  /** Clinical title used on the admin results page. */
  title: string;
  /** Heading on the section intro screen, e.g. "Section 1 of 5". */
  introHeading: string;
  /** Brand-voice line under the intro heading. */
  introLine: string;
};

export const SECTIONS: SurveySection[] = [
  {
    number: 1,
    title: "Quoting, Onboarding & Formulation",
    introHeading: "Section 1 of 5",
    introLine: "Quoting, onboarding, and formulation.",
  },
  {
    number: 2,
    title: "Partnership & Service",
    introHeading: "Section 2 of 5",
    introLine: "Partnership and service.",
  },
  {
    number: 3,
    title: "Product & Quality",
    introHeading: "Section 3 of 5",
    introLine: "Product and quality.",
  },
  {
    number: 4,
    title: "Growth & Capacity",
    introHeading: "Section 4 of 5",
    introLine: "Growth and capacity.",
  },
  {
    number: 5,
    title: "Partnership Outlook & Open Feedback",
    introHeading: "Section 5 of 5",
    introLine: "Partnership outlook.",
  },
];

/** Transition line shown after finishing section N (keyed by N). */
export const TRANSITIONS: Record<number, string> = {
  1: "Section 1 done. Partnership and service next.",
  2: "That's two. Three to go. Product and quality up next. About a minute left.",
  3: "Halfway home — and then some. Growth and capacity next.",
  4: "One section left. The bottom line.",
};

// ─── Rating questions ──────────────────────────────────────────────────────

export type SurveyQuestion = {
  /** Stable key ("q1".."q22") — used as the column key in stored responses. */
  id: string;
  /** 1-based display number. */
  number: number;
  /** Which section (1–5) this question belongs to. */
  section: number;
  text: string;
  scale: RatingScaleId;
};

export const QUESTIONS: SurveyQuestion[] = [
  // Section 1 — Quoting, Onboarding & Formulation
  { id: "q1", number: 1, section: 1, text: "Pricing & Value Perception", scale: "satisfaction" },
  { id: "q2", number: 2, section: 1, text: "Quoting Accuracy & Timeline", scale: "satisfaction" },
  { id: "q3", number: 3, section: 1, text: "Technical Expertise / Formulation Support", scale: "satisfaction" },
  { id: "q4", number: 4, section: 1, text: "Product Onboarding Process (Intake → Setup → First Production Run)", scale: "satisfaction" },

  // Section 2 — Partnership & Service
  { id: "q5", number: 5, section: 2, text: "Lead Times / Delivery Timelines", scale: "satisfaction" },
  { id: "q6", number: 6, section: 2, text: "Order Accuracy (Right Product, Quantity, Packaging)", scale: "satisfaction" },
  { id: "q7", number: 7, section: 2, text: "Issue Resolution & Handling of Problems", scale: "satisfaction" },
  { id: "q8", number: 8, section: 2, text: "Communication & Responsiveness", scale: "satisfaction" },
  { id: "q9", number: 9, section: 2, text: "Business Development Representative", scale: "satisfaction" },
  { id: "q10", number: 10, section: 2, text: "Account Manager", scale: "satisfaction" },
  { id: "q11", number: 11, section: 2, text: "Speed & Efficiency of Project Execution (Concept → Production)", scale: "satisfaction" },

  // Section 3 — Product & Quality
  { id: "q12", number: 12, section: 3, text: "Product Quality", scale: "satisfaction" },
  { id: "q13", number: 13, section: 3, text: "Consistency of Product (Batch to Batch)", scale: "satisfaction" },
  { id: "q14", number: 14, section: 3, text: "Packaging Quality & Options", scale: "satisfaction" },
  { id: "q15", number: 15, section: 3, text: "Raw Material Sourcing & Ingredient Quality", scale: "satisfaction" },
  { id: "q16", number: 16, section: 3, text: "Label Review & Regulatory / Compliance Support", scale: "satisfaction" },
  { id: "q17", number: 17, section: 3, text: "Documentation Quality (COAs, MSDS, Amazon Readiness)", scale: "satisfaction" },

  // Section 4 — Growth & Capacity
  { id: "q18", number: 18, section: 4, text: "MOQ Flexibility", scale: "satisfaction" },
  { id: "q19", number: 19, section: 4, text: "Capacity / Ability to Scale with Demand", scale: "satisfaction" },
  { id: "q20", number: 20, section: 4, text: "Overall Experience with WB Blends", scale: "satisfaction" },

  // Section 5 — Partnership Outlook
  { id: "q21", number: 21, section: 5, text: "Likelihood to Continue Partnership", scale: "likelihood" },
  { id: "q22", number: 22, section: 5, text: "Likelihood to Recommend WB Blends", scale: "nps" },
];

export const QUESTION_BY_ID: Record<string, SurveyQuestion> = Object.fromEntries(
  QUESTIONS.map(q => [q.id, q]),
);

export function questionsInSection(section: number): SurveyQuestion[] {
  return QUESTIONS.filter(q => q.section === section);
}

// ─── Open-ended questions ──────────────────────────────────────────────────

export type OpenQuestionId = "changeOne" | "upcoming";

export type OpenQuestion = {
  id: OpenQuestionId;
  text: string;
  placeholder: string;
};

export const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    id: "changeOne",
    text: "If you could change one thing about working with WB Blends that would have the biggest impact on your business, what would it be?",
    placeholder: "Optional — the one thing that would move the needle.",
  },
  {
    id: "upcoming",
    text: "Are there any upcoming projects we can support?",
    placeholder: "Optional — anything on your roadmap we should know about.",
  },
];

// ─── Screen copy ───────────────────────────────────────────────────────────
// All copy below is final per the handoff. Use exactly as written.

export const COPY = {
  welcome: {
    title: "Customer Experience Survey",
    body: "27 years in. We're still trying to get better at this. Your feedback is the only honest way to do that.",
    meta: "22 quick ratings. Two optional questions. About 3 minutes.",
    start: "Start",
  },
  contact: {
    heading: "Who are we hearing from?",
    body: "First name, last name, email. Then we start.",
    continue: "Continue",
  },
  review: {
    heading: "Ready when you are.",
    submit: "Submit",
    back: "Back to review",
  },
  done: {
    title: "That's it. Thank you.",
    body: "Your feedback goes straight to the team. Not into a folder. Not into a quarterly slide. To the people who can actually do something with it.",
    sign: "27 years in. Still listening.",
    cta: "Return to wbblends.com",
    ctaHref: "https://wbblends.com",
  },
  micro: {
    next: "Next",
    skip: "Skip",
    continue: "Continue",
    backTooltip: "Previous question",
    resumeBanner: "Picking up where you left off.",
    addComment: "Add comment",
    commentLabel: "Comments (optional)",
    ratingRequired: "Pick a number to continue.",
  },
} as const;

// ─── Stored response shape ─────────────────────────────────────────────────

export type SurveyResponse = {
  id: string;
  surveyKey: string;
  /** Client-generated UUID — dedupes a respondent who submits twice. */
  respondentId: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Set when the link carried a ?customerId= attribution param. */
  customerId: string | null;
  /** Question id → rating value. */
  ratings: Record<string, number>;
  /** Question id → optional comment. Only populated questions appear. */
  comments: Record<string, string>;
  changeOne: string;
  upcoming: string;
  submittedAt: string;
};

// ─── Scoring helpers ───────────────────────────────────────────────────────

/** The 21 questions on a 1–5 scale (everything except the NPS question). */
export const FIVE_POINT_QUESTION_IDS = QUESTIONS.filter(
  q => q.scale !== "nps",
).map(q => q.id);

export type NpsCategory = "promoter" | "passive" | "detractor";

/** Buckets a 1–10 recommend score. Promoters 9–10, passives 7–8, the rest
 *  detractors — the standard NPS split applied to this 1–10 scale. */
export function npsCategory(value: number): NpsCategory {
  if (value >= 9) return "promoter";
  if (value >= 7) return "passive";
  return "detractor";
}

/** Net Promoter Score (-100..100) across a set of 1–10 recommend scores. */
export function netPromoterScore(values: number[]): number {
  if (values.length === 0) return 0;
  let promoters = 0;
  let detractors = 0;
  for (const v of values) {
    const cat = npsCategory(v);
    if (cat === "promoter") promoters += 1;
    else if (cat === "detractor") detractors += 1;
  }
  return Math.round(((promoters - detractors) / values.length) * 100);
}

/** Mean of a response's 1–5 answers — its overall satisfaction score. */
export function responseAverage(response: SurveyResponse): number {
  const vals = FIVE_POINT_QUESTION_IDS.map(id => response.ratings[id]).filter(
    (v): v is number => typeof v === "number",
  );
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}
