/**
 * Persistence for Customer Experience Survey responses.
 *
 * Rows live in the `survey_responses` table (see lib/db/schema.ts). Ratings
 * and per-question comments are stored as JSON blobs keyed by question id —
 * the question text itself stays in lib/survey/questions.ts so a copy edit
 * never touches the database.
 */
import { randomUUID } from "node:crypto";
import { ensureDb } from "@/lib/db";
import { SURVEY_KEY, type SurveyResponse } from "./questions";

/** Shape accepted by `insertSurveyResponse` — the API route validates the
 *  public payload down to this before calling. */
export type NewSurveyResponse = {
  respondentId: string;
  firstName: string;
  lastName: string;
  email: string;
  customerId: string | null;
  ratings: Record<string, number>;
  comments: Record<string, string>;
  changeOne: string;
  upcoming: string;
};

/** Persists a submission. Returns the stored row (with its generated id and
 *  server timestamp). */
export async function insertSurveyResponse(
  input: NewSurveyResponse,
): Promise<SurveyResponse> {
  const client = await ensureDb();
  const id = randomUUID();
  const submittedAt = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO survey_responses
            (id, survey_key, respondent_id, first_name, last_name, email,
             customer_id, ratings_json, comments_json, change_one, upcoming,
             submitted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      SURVEY_KEY,
      input.respondentId,
      input.firstName,
      input.lastName,
      input.email,
      input.customerId,
      JSON.stringify(input.ratings),
      JSON.stringify(input.comments),
      input.changeOne,
      input.upcoming,
      submittedAt,
    ],
  });

  return {
    id,
    surveyKey: SURVEY_KEY,
    respondentId: input.respondentId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    customerId: input.customerId,
    ratings: input.ratings,
    comments: input.comments,
    changeOne: input.changeOne,
    upcoming: input.upcoming,
    submittedAt,
  };
}

/** Every response for a survey wave, newest first. */
export async function listSurveyResponses(
  surveyKey: string = SURVEY_KEY,
): Promise<SurveyResponse[]> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT id, survey_key, respondent_id, first_name, last_name, email,
                 customer_id, ratings_json, comments_json, change_one,
                 upcoming, submitted_at
            FROM survey_responses
           WHERE survey_key = ?
           ORDER BY submitted_at DESC`,
    args: [surveyKey],
  });
  return rows.map(rowToResponse);
}

function rowToResponse(row: Record<string, unknown>): SurveyResponse {
  return {
    id: String(row.id),
    surveyKey: String(row.survey_key),
    respondentId: String(row.respondent_id ?? ""),
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    email: String(row.email ?? ""),
    customerId: row.customer_id == null ? null : String(row.customer_id),
    ratings: parseNumberMap(row.ratings_json),
    comments: parseStringMap(row.comments_json),
    changeOne: String(row.change_one ?? ""),
    upcoming: String(row.upcoming ?? ""),
    submittedAt: String(row.submitted_at),
  };
}

function parseNumberMap(raw: unknown): Record<string, number> {
  try {
    const parsed = JSON.parse(String(raw ?? "{}")) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function parseStringMap(raw: unknown): Record<string, string> {
  try {
    const parsed = JSON.parse(String(raw ?? "{}")) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
