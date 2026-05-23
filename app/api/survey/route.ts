/**
 * Public submission endpoint for the Customer Experience Survey.
 *
 * No auth: the survey is filled out anonymously via a shared link, so this is
 * a system boundary — every field is validated here before it reaches the DB.
 * On a valid submission the row is stored and a notification email goes out
 * to the recipients in SURVEY_NOTIFY_EMAILS (defaults to Devin's WB address).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import {
  QUESTIONS,
  SCALES,
  FREE_TEXT_MAX,
} from "@/lib/survey/questions";
import { insertSurveyResponse } from "@/lib/survey/store";
import { listCustomers } from "@/lib/customers/registry";
import { sendEmail } from "@/lib/email/sender";
import { surveyNotificationEmail } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

const DEFAULT_NOTIFY = "dsimmons@westernbotanicals.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Comma/whitespace-separated recipient list from the env, default to Devin. */
function notifyRecipients(): string[] {
  const raw = process.env.SURVEY_NOTIFY_EMAILS;
  const list = (raw && raw.trim() ? raw : DEFAULT_NOTIFY)
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(s => EMAIL_RE.test(s));
  return list.length > 0 ? list : [DEFAULT_NOTIFY];
}

function clampText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, FREE_TEXT_MAX);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const firstName = clampText(body.firstName).slice(0, 100);
  const lastName = clampText(body.lastName).slice(0, 100);
  const email = clampText(body.email).slice(0, 200);

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First and last name are required." },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 },
    );
  }

  // Ratings — each question is optional (the respondent can mark it Not
  // Applicable and skip), but anything they did send must be a valid integer
  // inside that question's scale.
  const rawRatings =
    body.ratings && typeof body.ratings === "object"
      ? (body.ratings as Record<string, unknown>)
      : {};
  const ratings: Record<string, number> = {};
  for (const q of QUESTIONS) {
    const v = rawRatings[q.id];
    if (v === undefined || v === null) continue;
    const scale = SCALES[q.scale];
    if (
      typeof v !== "number" ||
      !Number.isInteger(v) ||
      v < scale.min ||
      v > scale.max
    ) {
      return NextResponse.json(
        { error: `Invalid rating for question ${q.number}.` },
        { status: 400 },
      );
    }
    ratings[q.id] = v;
  }

  // Comments — optional, keyed by question id, capped.
  const rawComments =
    body.comments && typeof body.comments === "object"
      ? (body.comments as Record<string, unknown>)
      : {};
  const comments: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const c = clampText(rawComments[q.id]);
    if (c) comments[q.id] = c;
  }

  // Closing free-text question — only `upcoming` is collected from the UI
  // now. `changeOne` is kept in the stored row for backwards compatibility
  // with older responses but is no longer required from new submissions.
  const changeOne = clampText(body.changeOne);
  const upcoming = clampText(body.upcoming);
  if (!upcoming) {
    return NextResponse.json(
      { error: "Please answer the final question." },
      { status: 400 },
    );
  }

  // Optional customer attribution from a ?customerId= link param.
  const validCustomerIds = new Set(listCustomers().map(c => c.id));
  const customerId =
    typeof body.customerId === "string" && validCustomerIds.has(body.customerId)
      ? body.customerId
      : null;

  const respondentId =
    typeof body.respondentId === "string" && body.respondentId.trim()
      ? body.respondentId.trim().slice(0, 64)
      : randomUUID();

  const stored = await insertSurveyResponse({
    respondentId,
    firstName,
    lastName,
    email,
    customerId,
    ratings,
    comments,
    changeOne,
    upcoming,
  });

  // Notify the team. Email failures must not fail the submission — the row is
  // already saved and visible on the admin page.
  const msg = surveyNotificationEmail(stored);
  for (const to of notifyRecipients()) {
    try {
      await sendEmail({ to, ...msg });
    } catch (err) {
      console.error("[api/survey] notification email failed", err);
    }
  }

  return NextResponse.json({ ok: true, id: stored.id });
}
