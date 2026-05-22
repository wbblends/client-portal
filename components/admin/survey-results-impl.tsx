"use client";

/**
 * Customer Feedback — results view for the Customer Experience Survey.
 *
 * Renders three things off the same response set:
 *  1. Headline stats (response count, average satisfaction, NPS).
 *  2. Visualizations — average rating per question, the NPS split, the
 *     overall 1–5 distribution, and the most notable comments per score.
 *  3. The individual submissions, each expandable to its full answer sheet.
 *
 * When there are no real responses yet the page falls back to sample data
 * (see lib/survey/sample-data.ts) and shows a banner saying so.
 */

import { useMemo, useState, type ReactNode } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
import { getCustomer } from "@/lib/customers/registry";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import {
  QUESTIONS,
  SCALES,
  SECTIONS,
  netPromoterScore,
  npsCategory,
  responseAverage,
  FIVE_POINT_QUESTION_IDS,
  type SurveyResponse,
} from "@/lib/survey/questions";

const TOOLTIP_STYLE = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "var(--shadow-popover)",
} as const;

/** Colors the 1–5 satisfaction scale on a red→green sentiment ramp. */
const SCORE_COLORS: Record<number, string> = {
  1: "var(--color-danger)",
  2: "var(--color-warning)",
  3: "var(--color-muted)",
  4: "var(--color-primary)",
  5: "var(--color-success)",
};

function bandColor(avg: number): string {
  if (avg < 3) return "var(--color-danger)";
  if (avg < 3.8) return "var(--color-warning)";
  if (avg < 4.4) return "var(--color-primary)";
  return "var(--color-success)";
}

export function SurveyResults({
  responses,
  isSample,
}: {
  responses: SurveyResponse[];
  isSample: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();

  const agg = useMemo(() => computeAggregates(responses), [responses]);

  return (
    <div className="space-y-8">
      {isSample && (
        <div className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-foreground-soft">
          <span className="font-bold uppercase tracking-wide text-warning">
            Sample data
          </span>{" "}
          — no real responses yet. These charts populate automatically once
          customers start submitting{" "}
          <code className="font-mono text-xs">wbblends.app/q2-2026-survey</code>.
        </div>
      )}

      {/* ── Headline stats ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Responses"
          value={String(responses.length)}
          hint={isSample ? "sample submissions" : "submissions received"}
        />
        <StatCard
          label="Avg satisfaction"
          value={`${agg.overallAvg.toFixed(2)}`}
          hint="across all 1–5 questions"
        />
        <StatCard
          label="Recommend score"
          value={`${agg.avgRecommend.toFixed(1)}`}
          hint="avg likelihood, out of 10"
        />
        <StatCard
          label="Net Promoter Score"
          value={`${agg.nps > 0 ? "+" : ""}${agg.nps}`}
          hint={`${agg.npsSplit.promoter} promoters · ${agg.npsSplit.detractor} detractors`}
        />
      </div>

      {/* ── Average rating by question ── */}
      <section className="space-y-3">
        <SectionTitle>Average rating by question</SectionTitle>
        <Card className="p-5 sm:p-6">
          <div className="space-y-6">
            {SECTIONS.filter(s => s.number <= 5).map(section => {
              const rows = agg.byQuestion.filter(
                r => r.section === section.number && r.scale !== "nps",
              );
              if (rows.length === 0) return null;
              return (
                <div key={section.number}>
                  <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-soft">
                    {section.title}
                  </p>
                  <div className="space-y-2.5">
                    {rows.map(r => (
                      <QuestionBar
                        key={r.id}
                        label={`Q${r.number}. ${r.text}`}
                        avg={r.avg}
                        max={5}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* ── Distributions ── */}
      <section className="space-y-3">
        <SectionTitle>Distributions</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Likelihood to recommend"
            subtitle="Q22 · NPS split"
          >
            <Donut
              data={[
                { name: "Promoters", value: agg.npsSplit.promoter, color: "var(--color-success)" },
                { name: "Passives", value: agg.npsSplit.passive, color: "var(--color-muted)" },
                { name: "Detractors", value: agg.npsSplit.detractor, color: "var(--color-danger)" },
              ]}
              centerValue={`${agg.nps > 0 ? "+" : ""}${agg.nps}`}
              centerLabel="NPS"
              reducedMotion={reducedMotion}
            />
          </ChartCard>
          <ChartCard
            title="Overall rating distribution"
            subtitle="Every 1–5 answer, all questions"
          >
            <Donut
              data={[5, 4, 3, 2, 1].map(score => ({
                name: `${score} — ${SCALES.satisfaction.options.find(o => o.value === score)?.label ?? score}`,
                value: agg.distribution[score] ?? 0,
                color: SCORE_COLORS[score],
              }))}
              centerValue={agg.overallAvg.toFixed(2)}
              centerLabel="avg"
              reducedMotion={reducedMotion}
            />
          </ChartCard>
        </div>
      </section>

      {/* ── Notable comments ── */}
      <section className="space-y-3">
        <SectionTitle>Most notable comments</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <CommentColumn
            heading="What's working"
            tone="good"
            comments={agg.notable.positive}
          />
          <CommentColumn
            heading="What needs work"
            tone="bad"
            comments={agg.notable.negative}
          />
        </div>
      </section>

      {/* ── Open feedback ── */}
      <section className="space-y-3">
        <SectionTitle>Open feedback</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <OpenFeedbackCard
            heading="The one thing that would change their business"
            items={agg.openFeedback
              .filter(o => o.changeOne)
              .map(o => ({ name: o.name, text: o.changeOne }))}
          />
          <OpenFeedbackCard
            heading="Upcoming projects we can support"
            items={agg.openFeedback
              .filter(o => o.upcoming)
              .map(o => ({ name: o.name, text: o.upcoming }))}
          />
        </div>
      </section>

      {/* ── Individual responses ── */}
      <section className="space-y-3">
        <SectionTitle>
          Individual responses ({responses.length})
        </SectionTitle>
        <Card className="divide-y divide-border">
          {responses.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">
              No responses yet.
            </p>
          ) : (
            responses.map(r => <ResponseRow key={r.id} response={r} />)
          )}
        </Card>
      </section>
    </div>
  );
}

// ─── Aggregation ───────────────────────────────────────────────────────────

type QuestionAgg = {
  id: string;
  number: number;
  section: number;
  text: string;
  scale: string;
  avg: number;
};

type NotableComment = {
  name: string;
  questionText: string;
  questionNumber: number;
  score: number;
  comment: string;
};

function computeAggregates(responses: SurveyResponse[]) {
  // Average per question.
  const byQuestion: QuestionAgg[] = QUESTIONS.map(q => {
    const vals = responses
      .map(r => r.ratings[q.id])
      .filter((v): v is number => typeof v === "number");
    const avg =
      vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    return {
      id: q.id,
      number: q.number,
      section: q.section,
      text: q.text,
      scale: q.scale,
      avg,
    };
  });

  // Overall average across every 1–5 answer.
  const fivePointVals: number[] = [];
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of responses) {
    for (const id of FIVE_POINT_QUESTION_IDS) {
      const v = r.ratings[id];
      if (typeof v === "number") {
        fivePointVals.push(v);
        distribution[v] = (distribution[v] ?? 0) + 1;
      }
    }
  }
  const overallAvg =
    fivePointVals.length > 0
      ? fivePointVals.reduce((s, v) => s + v, 0) / fivePointVals.length
      : 0;

  // NPS.
  const npsValues = responses
    .map(r => r.ratings.q22)
    .filter((v): v is number => typeof v === "number");
  const nps = netPromoterScore(npsValues);
  const avgRecommend =
    npsValues.length > 0
      ? npsValues.reduce((s, v) => s + v, 0) / npsValues.length
      : 0;
  const npsSplit = { promoter: 0, passive: 0, detractor: 0 };
  for (const v of npsValues) npsSplit[npsCategory(v)] += 1;

  // Notable comments — every per-question comment, tagged with its score.
  const allComments: NotableComment[] = [];
  for (const r of responses) {
    const name = `${r.firstName} ${r.lastName}`.trim() || "Anonymous";
    for (const q of QUESTIONS) {
      const comment = r.comments[q.id];
      const score = r.ratings[q.id];
      if (comment && typeof score === "number") {
        allComments.push({
          name,
          questionText: q.text,
          questionNumber: q.number,
          score,
          comment,
        });
      }
    }
  }
  const positive = allComments
    .filter(c => c.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const negative = allComments
    .filter(c => c.score <= 3)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);

  const openFeedback = responses.map(r => ({
    name: `${r.firstName} ${r.lastName}`.trim() || "Anonymous",
    changeOne: r.changeOne,
    upcoming: r.upcoming,
  }));

  return {
    byQuestion,
    overallAvg,
    distribution,
    nps,
    avgRecommend,
    npsSplit,
    notable: { positive, negative },
    openFeedback,
  };
}

// ─── Presentational pieces ─────────────────────────────────────────────────

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
      {children}
    </h2>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </Card>
  );
}

/** A labeled horizontal bar for one question's average. */
function QuestionBar({
  label,
  avg,
  max,
}: {
  label: string;
  avg: number;
  max: number;
}) {
  const pct = max > 0 ? (avg / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[44%] shrink-0 truncate text-sm text-foreground-soft sm:w-[48%]">
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-accent">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: bandColor(avg) }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
        {avg > 0 ? avg.toFixed(1) : "—"}
      </span>
    </div>
  );
}

type DonutDatum = { name: string; value: number; color: string };

function Donut({
  data,
  centerValue,
  centerLabel,
  reducedMotion,
}: {
  data: DonutDatum[];
  centerValue: string;
  centerLabel: string;
  reducedMotion: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted">
        No data to chart yet.
      </div>
    );
  }
  return (
    <div className="relative h-[260px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="88%"
            stroke="var(--color-card)"
            strokeWidth={2}
            paddingAngle={1}
            isAnimationActive={!reducedMotion}
            animationDuration={650}
          >
            {data.map(d => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => {
              const v = Number(value);
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return [`${v} · ${pct}%`, String(name)];
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="square"
            wrapperStyle={{ fontSize: 11, color: "var(--color-foreground-soft)" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-10">
        <div className="font-display text-[28px] tabular-nums tracking-tight text-foreground">
          {centerValue}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {centerLabel}
        </div>
      </div>
    </div>
  );
}

function CommentColumn({
  heading,
  tone,
  comments,
}: {
  heading: string;
  tone: "good" | "bad";
  comments: NotableComment[];
}) {
  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {heading}
      </h3>
      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No comments in this range yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {comments.map((c, i) => (
            <li
              key={i}
              className={cn(
                "rounded-lg border-l-2 bg-surface px-3 py-2",
                tone === "good" ? "border-success" : "border-danger",
              )}
            >
              <p className="text-sm text-foreground-soft">“{c.comment}”</p>
              <p className="mt-1 text-xs text-muted-soft">
                {c.name} · Q{c.questionNumber} {c.questionText} ·{" "}
                <span
                  className={cn(
                    "font-semibold",
                    tone === "good" ? "text-success" : "text-danger",
                  )}
                >
                  {c.score}/5
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OpenFeedbackCard({
  heading,
  items,
}: {
  heading: string;
  items: { name: string; text: string }[];
}) {
  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {heading}
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No answers yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((it, i) => (
            <li key={i}>
              <p className="text-sm text-foreground-soft">{it.text}</p>
              <p className="mt-0.5 text-xs text-muted-soft">— {it.name}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ResponseRow({ response }: { response: SurveyResponse }) {
  const [open, setOpen] = useState(false);
  const name =
    `${response.firstName} ${response.lastName}`.trim() || "Anonymous";
  const avg = responseAverage(response);
  const recommend = response.ratings.q22;
  const customer = response.customerId
    ? getCustomer(response.customerId)
    : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-accent"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-soft transition-transform",
            open && "rotate-180",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {name}
          </p>
          <p className="truncate text-xs text-muted">
            {response.email}
            {customer ? ` · ${customer.name}` : ""}
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-xs text-muted-soft">Submitted</p>
          <p className="text-sm text-foreground-soft">
            {formatDate(response.submittedAt, "short")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-soft">Avg</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {avg.toFixed(2)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-soft">Rec.</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {typeof recommend === "number" ? `${recommend}/10` : "—"}
          </p>
        </div>
      </button>

      {open && (
        <div className="bg-surface px-5 pb-5 pt-1">
          <div className="space-y-1">
            {QUESTIONS.map(q => {
              const value = response.ratings[q.id];
              const scale = SCALES[q.scale];
              const opt = scale.options.find(o => o.value === value);
              const comment = response.comments[q.id];
              return (
                <div
                  key={q.id}
                  className="flex flex-col gap-0.5 border-b border-border/60 py-1.5 sm:flex-row sm:items-baseline sm:gap-3"
                >
                  <span className="flex-1 text-sm text-foreground-soft">
                    Q{q.number}. {q.text}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {typeof value === "number"
                      ? `${value}/${scale.max}${opt && opt.label !== String(opt.value) ? ` — ${opt.label}` : ""}`
                      : "—"}
                  </span>
                  {comment && (
                    <p className="basis-full text-xs italic text-muted">
                      “{comment}”
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {(response.changeOne || response.upcoming) && (
            <div className="mt-3 space-y-2">
              {response.changeOne && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-soft">
                    One thing to change
                  </p>
                  <p className="text-sm text-foreground-soft">
                    {response.changeOne}
                  </p>
                </div>
              )}
              {response.upcoming && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-soft">
                    Upcoming projects
                  </p>
                  <p className="text-sm text-foreground-soft">
                    {response.upcoming}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
