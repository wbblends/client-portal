/**
 * WB Blends Customer Experience Survey — question set, scales, and screen copy.
 *
 * Single source of truth shared by the public survey flow
 * (`app/q2-2026-survey/`) and the admin results page
 * (`app/(portal)/admin/customer-feedback/`) so both render the same question
 * text, the same scale endpoints, and the same number of work screens.
 *
 * 4 sections, 9 rating questions (8 on a 1–5 scale, the recommend question on
 * a 1–10 NPS scale), 2 required free-text questions. Question order follows
 * the customer lifecycle — quoting → service → product → outlook — so adjacent
 * questions don't bias each other.
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
  // Satisfaction questions — clinical wording, kept neutral per the handoff.
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
  // Likelihood-to-continue question.
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
  // Recommend question — true NPS scale, kept at 1–10 (not collapsed to 1–5)
  // so the result is comparable to standard NPS benchmarks.
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
  /** Section title — shown on the intro screen and the admin results page. */
  title: string;
  /** Small eyebrow above the title on the section intro screen. */
  introHeading: string;
};

export const SECTIONS: SurveySection[] = [
  { number: 1, title: "Quoting, Onboarding & Formulation", introHeading: "Section One" },
  { number: 2, title: "Partnership & Service", introHeading: "Section Two" },
  { number: 3, title: "Product & Quality", introHeading: "Section Three" },
  { number: 4, title: "Partnership Outlook & Open Feedback", introHeading: "Section Four" },
];

// ─── Rating questions ──────────────────────────────────────────────────────

export type SurveyQuestion = {
  /** Stable key ("q1".."q22") — used as the column key in stored responses. */
  id: string;
  /** 1-based display number. */
  number: number;
  /** Which section this question belongs to. */
  section: number;
  text: string;
  scale: RatingScaleId;
  /** Optional override for the rating-screen lead-in ("How would you rate
   *  ___:"). Defaults to "How would you rate our:". Set to a "your" variant
   *  for questions about people assigned to the customer (BDR, AM). */
  leadIn?: string;
};

// `id` is the stable stored-response column key and never changes; `number`
// is the display position the respondent sees and is renumbered when the set
// changes.
export const QUESTIONS: SurveyQuestion[] = [
  // Section 1 — Quoting, Onboarding & Formulation
  { id: "q2", number: 1, section: 1, text: "Quoting Accuracy & Speed", scale: "satisfaction" },
  { id: "q3", number: 2, section: 1, text: "New Product Development / Formulation Support", scale: "satisfaction" },
  { id: "q4", number: 3, section: 1, text: "Product Onboarding Process (Quote → R&D → FPS → Production Run)", scale: "satisfaction" },

  // Section 2 — Partnership & Service
  { id: "q5", number: 4, section: 2, text: "Lead Times / Delivery Timelines", scale: "satisfaction" },
  { id: "q8", number: 5, section: 2, text: "Communication & Responsiveness", scale: "satisfaction" },
  { id: "q9", number: 6, section: 2, text: "Business Development Representative (Communication, Technical Expertise, etc)", scale: "satisfaction", leadIn: "How would you rate your:" },
  { id: "q10", number: 7, section: 2, text: "Account Manager (Communication, Collaboration, Expertise, etc)", scale: "satisfaction", leadIn: "How would you rate your:" },

  // Section 3 — Product & Quality
  { id: "q12", number: 8, section: 3, text: "Overall Quality (Product Quality Standards)", scale: "satisfaction" },

  // Section 4 — Partnership Outlook
  { id: "q22", number: 9, section: 4, text: "Likelihood to Recommend WB Blends", scale: "nps" },
];

export const QUESTION_BY_ID: Record<string, SurveyQuestion> = Object.fromEntries(
  QUESTIONS.map(q => [q.id, q]),
);

export function questionsInSection(section: number): SurveyQuestion[] {
  return QUESTIONS.filter(q => q.section === section);
}

/** The recommend question — the single rating on the 1–10 NPS scale. Derived
 *  so anything that needs the NPS answer survives a question renumbering. */
export const NPS_QUESTION: SurveyQuestion =
  QUESTIONS.find(q => q.scale === "nps") ?? QUESTIONS[QUESTIONS.length - 1];

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
    placeholder: "The one thing that would move the needle.",
  },
  {
    id: "upcoming",
    text: "Are there any upcoming projects we can support?",
    placeholder: "Anything on your roadmap we should know about.",
  },
];

// ─── Screen copy ───────────────────────────────────────────────────────────
// All copy below is final per the handoff. Use exactly as written.

export const COPY = {
  welcome: {
    title: "Customer Experience Survey",
    body: "We appreciate your honest feedback, and your responses are only shared with our executive team.",
    meta: "~3 minutes",
    start: "Let's get started",
  },
  contact: {
    heading: "Who are we hearing from?",
    body: "First name, last name, email.",
    continue: "Continue",
  },
  review: {
    heading: "Thanks for taking the time.",
    body: "Click Submit if you're ready, or Back to review to change your responses.",
    reminder:
      "As a reminder, your responses will be confidential to anyone outside of our executive team.",
    submit: "Submit",
    back: "Back to review",
  },
  done: {
    title: "We appreciate you!",
    body: "We are grateful for the opportunity to earn your business.",
    cta: "Return to wbblends.com",
    ctaHref: "https://wbblends.com",
  },
  micro: {
    continue: "Continue",
    skipNa: "Not Applicable, Skip",
    backTooltip: "Previous question",
    resumeBanner: "Picking up where you left off.",
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
