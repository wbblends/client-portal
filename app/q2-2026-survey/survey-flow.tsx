"use client";

/**
 * Customer Experience Survey — the public, mobile-first survey flow.
 *
 *  - One question per screen; a rating screen shows a Continue button once
 *    answered so the respondent can add a comment before moving on.
 *  - A thin progress bar that only moves on the "work" screens (contact +
 *    20 ratings + 2 open-ended) — never on section intro screens.
 *  - Section intro screens carry the brand voice; the rating questions stay
 *    clinical.
 *  - Back navigation, keyboard support (digit keys select a rating, Enter
 *    advances), and localStorage autosave so a closed tab can resume.
 *
 * Everything is anonymous-by-link: there is no logged-in user. Per Devin's
 * ask, the form also collects first name / last name / email up front.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import {
  COPY,
  OPEN_QUESTIONS,
  SCALES,
  SECTIONS,
  SURVEY_KEY,
  FREE_TEXT_MAX,
  FREE_TEXT_COUNTER_AT,
  questionsInSection,
  type OpenQuestion,
  type SurveyQuestion,
  type SurveySection,
} from "@/lib/survey/questions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORAGE_KEY = `wbb.survey.${SURVEY_KEY}`;

// ─── Step model ────────────────────────────────────────────────────────────

type Step =
  | { kind: "contact" }
  | { kind: "section-intro"; section: SurveySection }
  | { kind: "question"; question: SurveyQuestion }
  | { kind: "open"; question: OpenQuestion }
  | { kind: "review" };

/** Flattened screen order. A section intro sits ahead of each rating block;
 *  the two open-ended questions trail section 5. */
const STEPS: Step[] = (() => {
  const out: Step[] = [{ kind: "contact" }];
  for (const section of SECTIONS) {
    out.push({ kind: "section-intro", section });
    for (const q of questionsInSection(section.number)) {
      out.push({ kind: "question", question: q });
    }
    if (section.number === 5) {
      for (const q of OPEN_QUESTIONS) out.push({ kind: "open", question: q });
    }
  }
  out.push({ kind: "review" });
  return out;
})();

const isWorkStep = (s: Step) =>
  s.kind === "contact" || s.kind === "question" || s.kind === "open";

/** Total work screens — drives the progress bar denominator (25). */
const TOTAL_WORK = STEPS.filter(isWorkStep).length;

/** Count of work screens strictly before `index`. */
function workDoneBefore(index: number): number {
  let n = 0;
  for (let i = 0; i < index && i < STEPS.length; i++) {
    if (isWorkStep(STEPS[i])) n += 1;
  }
  return n;
}

// ─── Persisted state ───────────────────────────────────────────────────────

type Contact = { firstName: string; lastName: string; email: string };

type Saved = {
  respondentId: string;
  phase: "welcome" | "flow";
  stepIndex: number;
  contact: Contact;
  ratings: Record<string, number>;
  comments: Record<string, string>;
  changeOne: string;
  upcoming: string;
};

/** Fires a lightweight custom event so a future analytics layer can measure
 *  completion-rate without this component depending on one today. */
function track(event: string, detail: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("wbb-survey", { detail: { event, ...detail } }),
    );
  } catch {
    /* no-op */
  }
}

// ─── Root ──────────────────────────────────────────────────────────────────

export function SurveyFlow({ customerId }: { customerId: string | null }) {
  const [phase, setPhase] = useState<
    "welcome" | "flow" | "submitting" | "done"
  >("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<"fwd" | "back">("fwd");
  const [respondentId, setRespondentId] = useState("");
  const [resumed, setResumed] = useState(false);

  const [contact, setContact] = useState<Contact>({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [changeOne, setChangeOne] = useState("");
  const [upcoming, setUpcoming] = useState("");

  const [contactErrors, setContactErrors] = useState<Partial<Contact>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hydrated = useRef(false);

  // ── Restore on mount ──
  useEffect(() => {
    let saved: Saved | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) as Saved;
    } catch {
      saved = null;
    }
    if (saved && saved.respondentId) {
      setRespondentId(saved.respondentId);
      setContact(saved.contact ?? contact);
      setRatings(saved.ratings ?? {});
      setComments(saved.comments ?? {});
      setChangeOne(saved.changeOne ?? "");
      setUpcoming(saved.upcoming ?? "");
      if (saved.phase === "flow") {
        setPhase("flow");
        setStepIndex(Math.min(Math.max(saved.stepIndex ?? 0, 0), STEPS.length - 1));
        setResumed(true);
      }
    } else {
      setRespondentId(
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `r-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      );
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist on change ──
  useEffect(() => {
    if (!hydrated.current || !respondentId) return;
    if (phase === "done" || phase === "submitting") return;
    const payload: Saved = {
      respondentId,
      phase: phase === "welcome" ? "welcome" : "flow",
      stepIndex,
      contact,
      ratings,
      comments,
      changeOne,
      upcoming,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* storage full / disabled — progress just won't survive a reload */
    }
  }, [
    phase,
    stepIndex,
    respondentId,
    contact,
    ratings,
    comments,
    changeOne,
    upcoming,
  ]);

  // ── Abandonment beacon ──
  useEffect(() => {
    if (phase !== "flow") return;
    const onLeave = () => track("abandon", { stepIndex });
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [phase, stepIndex]);

  const step = STEPS[stepIndex];

  const goNext = useCallback(() => {
    setDirection("fwd");
    setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
    setResumed(false);
  }, []);

  const goBack = useCallback(() => {
    setDirection("back");
    setResumed(false);
    if (stepIndex === 0) {
      setPhase("welcome");
      return;
    }
    setStepIndex(i => Math.max(i - 1, 0));
  }, [stepIndex]);

  const start = useCallback(() => {
    setDirection("fwd");
    setPhase("flow");
    setStepIndex(0);
    track("start");
  }, []);

  const submit = useCallback(async () => {
    setPhase("submitting");
    setSubmitError(null);
    track("submit");
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respondentId,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          customerId,
          ratings,
          comments,
          changeOne,
          upcoming,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Submission failed. Try again.");
      }
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* no-op */
      }
      setPhase("done");
      track("complete");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Submission failed. Try again.",
      );
      setPhase("flow");
    }
  }, [respondentId, contact, customerId, ratings, comments, changeOne, upcoming]);

  /** Records a rating. The screen no longer auto-advances — a Continue button
   *  appears once answered so an in-progress comment is never interrupted. */
  const pickRating = useCallback((qid: string, value: number) => {
    setRatings(r => ({ ...r, [qid]: value }));
  }, []);

  // ── Keyboard ──
  useEffect(() => {
    if (phase !== "flow") return;
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

      if (step.kind === "question" && !typing) {
        const scale = SCALES[step.question.scale];
        let value: number | null = null;
        if (e.key >= "1" && e.key <= "9") value = Number(e.key);
        else if (e.key === "0" && scale.max === 10) value = 10;
        if (value != null && value >= scale.min && value <= scale.max) {
          e.preventDefault();
          pickRating(step.question.id, value);
        } else if (
          e.key === "Enter" &&
          typeof ratings[step.question.id] === "number"
        ) {
          e.preventDefault();
          goNext();
        }
      } else if (step.kind === "section-intro" && e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (
        step.kind === "open" &&
        e.key === "Enter" &&
        (e.metaKey || e.ctrlKey)
      ) {
        const filled =
          step.question.id === "changeOne"
            ? changeOne.trim()
            : upcoming.trim();
        if (filled) {
          e.preventDefault();
          goNext();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, step, goNext, pickRating, ratings, changeOne, upcoming]);

  // ── Render ──
  if (phase === "welcome") {
    return (
      <SurveyShell>
        <WelcomeScreen onStart={start} />
      </SurveyShell>
    );
  }

  if (phase === "done") {
    return (
      <SurveyShell>
        <DoneScreen />
      </SurveyShell>
    );
  }

  const workDone =
    step.kind === "review" ? TOTAL_WORK : workDoneBefore(stepIndex);
  const progress = workDone / TOTAL_WORK;
  const workLabel = isWorkStep(step)
    ? `${workDone + 1} of ${TOTAL_WORK}`
    : null;

  return (
    <SurveyShell>
      <ProgressBar fraction={progress} />
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-5 pb-10 pt-4 sm:px-6">
        <header className="flex items-center justify-between gap-3 py-2">
          <button
            type="button"
            onClick={goBack}
            title={COPY.micro.backTooltip}
            aria-label={COPY.micro.backTooltip}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="min-w-10 text-right text-xs font-semibold tabular-nums text-muted-soft">
            {workLabel ?? ""}
          </span>
        </header>

        {resumed && (
          <p className="mb-2 rounded-lg bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">
            {COPY.micro.resumeBanner}
          </p>
        )}

        <div
          key={stepIndex}
          className={cn(
            "flex flex-1 flex-col justify-center py-6",
            direction === "fwd" ? "animate-survey-fwd" : "animate-survey-back",
          )}
        >
          {step.kind === "contact" && (
            <ContactScreen
              value={contact}
              errors={contactErrors}
              onChange={next => {
                setContact(next);
                setContactErrors({});
              }}
              onContinue={() => {
                const errs = validateContact(contact);
                if (Object.keys(errs).length > 0) {
                  setContactErrors(errs);
                  return;
                }
                goNext();
              }}
            />
          )}

          {step.kind === "section-intro" && (
            <IntroScreen section={step.section} onContinue={goNext} />
          )}

          {step.kind === "question" && (
            <RatingScreen
              question={step.question}
              value={ratings[step.question.id]}
              comment={comments[step.question.id] ?? ""}
              onPick={pickRating}
              onComment={(qid, text) =>
                setComments(c => {
                  const next = { ...c };
                  if (text.trim()) next[qid] = text;
                  else delete next[qid];
                  return next;
                })
              }
              onNext={goNext}
            />
          )}

          {step.kind === "open" && (
            <OpenScreen
              question={step.question}
              value={step.question.id === "changeOne" ? changeOne : upcoming}
              onChange={text =>
                step.question.id === "changeOne"
                  ? setChangeOne(text)
                  : setUpcoming(text)
              }
              onNext={goNext}
            />
          )}

          {step.kind === "review" && (
            <ReviewScreen
              submitting={phase === "submitting"}
              error={submitError}
              onSubmit={submit}
              onBack={goBack}
            />
          )}
        </div>
      </div>
    </SurveyShell>
  );
}

function validateContact(c: Contact): Partial<Contact> {
  const errs: Partial<Contact> = {};
  if (!c.firstName.trim()) errs.firstName = "Required.";
  if (!c.lastName.trim()) errs.lastName = "Required.";
  if (!EMAIL_RE.test(c.email.trim())) errs.email = "Enter a valid email.";
  return errs;
}

// ─── Shell + chrome ────────────────────────────────────────────────────────

/** Background chrome mirrors the portal login page: an ambient brand wash, a
 *  hairline accent at the top edge, and a faint grain texture. The layers are
 *  `fixed` so they never affect document flow or scrolling. */
function SurveyShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col bg-surface">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 88% 10%, color-mix(in oklab, var(--color-primary) 16%, transparent), transparent 65%), radial-gradient(50rem 36rem at 6% 95%, color-mix(in oklab, var(--color-primary) 9%, transparent), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-primary) 50%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />
      <div className="relative flex flex-1 flex-col">{children}</div>
    </main>
  );
}

function ProgressBar({ fraction }: { fraction: number }) {
  return (
    <div
      className="fixed inset-x-0 top-0 z-10 h-1 bg-border/60"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      aria-label="Survey progress"
    >
      <div
        className="h-full bg-primary transition-[width] duration-500 ease-out"
        style={{ width: `${Math.min(Math.max(fraction, 0), 1) * 100}%` }}
      />
    </div>
  );
}

// ─── Screens ───────────────────────────────────────────────────────────────

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[560px]">{children}</div>
    </div>
  );
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") onStart();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

  return (
    <CenteredScreen>
      <Logo size="lg" />
      <h1 className="mt-10 font-display text-[clamp(45px,8.1vw,63px)] leading-[1.08] tracking-tight text-foreground">
        {COPY.welcome.title}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        {COPY.welcome.body}
      </p>
      <p className="mt-3 text-sm font-semibold text-foreground-soft">
        {COPY.welcome.meta}
      </p>
      <PrimaryButton className="mt-8" onClick={onStart}>
        {COPY.welcome.start}
      </PrimaryButton>
    </CenteredScreen>
  );
}

function DoneScreen() {
  return (
    <CenteredScreen>
      <Logo size="lg" />
      <h1 className="mt-10 font-display text-[clamp(28px,5vw,40px)] leading-[1.1] tracking-tight text-foreground">
        {COPY.done.title}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        {COPY.done.body}
      </p>
      <a
        href={COPY.done.ctaHref}
        className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {COPY.done.cta}
      </a>
    </CenteredScreen>
  );
}

function ContactScreen({
  value,
  errors,
  onChange,
  onContinue,
}: {
  value: Contact;
  errors: Partial<Contact>;
  onChange: (next: Contact) => void;
  onContinue: () => void;
}) {
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onContinue();
      }}
    >
      <h2 className="font-display text-[clamp(24px,4vw,32px)] leading-tight tracking-tight text-foreground">
        {COPY.contact.heading}
      </h2>
      <p className="mt-2 text-sm text-muted">{COPY.contact.body}</p>

      <div className="mt-7 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            value={value.firstName}
            error={errors.firstName}
            autoFocus
            onChange={v => onChange({ ...value, firstName: v })}
          />
          <Field
            label="Last name"
            value={value.lastName}
            error={errors.lastName}
            onChange={v => onChange({ ...value, lastName: v })}
          />
        </div>
        <Field
          label="Email"
          type="email"
          value={value.email}
          error={errors.email}
          onChange={v => onChange({ ...value, email: v })}
        />
      </div>

      <PrimaryButton className="mt-8" type="submit">
        {COPY.contact.continue}
      </PrimaryButton>
    </form>
  );
}

function Field({
  label,
  value,
  error,
  type = "text",
  autoFocus,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  type?: string;
  autoFocus?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        className={cn(
          "h-12 w-full rounded-xl border bg-card px-4 text-base text-foreground outline-none transition-colors",
          error
            ? "border-danger"
            : "border-border focus:border-primary",
        )}
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

function IntroScreen({
  section,
  onContinue,
}: {
  section: SurveySection;
  onContinue: () => void;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
        {section.introHeading}
      </p>
      <h2 className="mt-3 font-display text-[clamp(26px,4.6vw,38px)] italic leading-[1.12] tracking-tight text-foreground">
        {section.title}
      </h2>
      <PrimaryButton className="mt-8" onClick={onContinue}>
        {COPY.micro.continue}
      </PrimaryButton>
    </div>
  );
}

function RatingScreen({
  question,
  value,
  comment,
  onPick,
  onComment,
  onNext,
}: {
  question: SurveyQuestion;
  value: number | undefined;
  comment: string;
  onPick: (qid: string, value: number) => void;
  onComment: (qid: string, text: string) => void;
  onNext: () => void;
}) {
  const scale = SCALES[question.scale];
  const [commentOpen, setCommentOpen] = useState(false);

  // A screen revisited via Back that already carries a comment opens with the
  // box expanded so the respondent sees what they wrote.
  useEffect(() => {
    setCommentOpen(comment.trim().length > 0);
  }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedOption = scale.options.find(o => o.value === value);
  const answered = typeof value === "number";

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-soft">
        Question {question.number}
      </p>
      <h2 className="mt-2 font-display italic text-[clamp(30px,5.1vw,39px)] leading-snug tracking-tight text-foreground">
        {question.text}
      </h2>

      <div
        className="mt-7 flex flex-wrap gap-2.5"
        role="radiogroup"
        aria-label={question.text}
      >
        {scale.options.map(opt => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${opt.value} — ${opt.label}`}
              onClick={() => onPick(question.id, opt.value)}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border text-base font-semibold tabular-nums transition-all duration-100",
                selected
                  ? "scale-105 border-primary bg-primary text-primary-foreground shadow-[var(--shadow-card-hover)]"
                  : "border-border-strong bg-card text-foreground-soft hover:border-primary hover:text-primary",
              )}
            >
              {opt.value}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex justify-between text-xs text-muted-soft">
        <span>
          {scale.min} · {scale.minLabel}
        </span>
        <span>
          {scale.max} · {scale.maxLabel}
        </span>
      </div>

      <p
        className={cn(
          "mt-4 h-5 text-sm font-semibold text-primary transition-opacity",
          selectedOption ? "opacity-100" : "opacity-0",
        )}
      >
        {selectedOption ? selectedOption.label : " "}
      </p>

      {/* Optional per-question comment — collapsed behind a small link. */}
      {commentOpen ? (
        <div className="mt-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
            {COPY.micro.commentLabel}
          </label>
          <textarea
            value={comment}
            rows={3}
            maxLength={FREE_TEXT_MAX}
            onChange={e => onComment(question.id, e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCommentOpen(true)}
          className="mt-2 text-sm font-semibold text-primary hover:underline"
        >
          + {COPY.micro.addComment}
        </button>
      )}

      {/* A Continue button appears once the question is answered, so the
          respondent can add a comment before moving on rather than being
          rushed off the screen. */}
      {answered && (
        <div className="mt-7">
          <PrimaryButton onClick={onNext}>{COPY.micro.continue}</PrimaryButton>
        </div>
      )}
    </div>
  );
}

function OpenScreen({
  question,
  value,
  onChange,
  onNext,
}: {
  question: OpenQuestion;
  value: string;
  onChange: (text: string) => void;
  onNext: () => void;
}) {
  const showCounter = value.length >= FREE_TEXT_COUNTER_AT;
  const filled = value.trim().length > 0;
  return (
    <div>
      <h2 className="font-display italic text-[clamp(30px,5.1vw,39px)] leading-snug tracking-tight text-foreground">
        {question.text}
      </h2>
      <textarea
        value={value}
        rows={5}
        autoFocus
        maxLength={FREE_TEXT_MAX}
        placeholder={question.placeholder}
        onChange={e => onChange(e.target.value)}
        className="mt-6 w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-soft focus:border-primary"
      />
      <div className="mt-1 h-4 text-right text-xs text-muted-soft">
        {showCounter ? `${value.length} / ${FREE_TEXT_MAX}` : " "}
      </div>
      <PrimaryButton className="mt-5" onClick={onNext} disabled={!filled}>
        {COPY.micro.continue}
      </PrimaryButton>
    </div>
  );
}

function ReviewScreen({
  submitting,
  error,
  onSubmit,
  onBack,
}: {
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 className="font-display text-[clamp(26px,4.6vw,38px)] leading-[1.12] tracking-tight text-foreground">
        {COPY.review.heading}
      </h2>
      <p className="mt-4 text-base leading-relaxed text-muted">
        {COPY.review.body}
      </p>
      <p className="mt-3 rounded-lg bg-primary-soft px-3.5 py-2.5 text-sm font-semibold text-primary">
        {COPY.review.reminder}
      </p>
      {error && (
        <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <PrimaryButton onClick={onSubmit} disabled={submitting}>
          {submitting ? "Submitting…" : COPY.review.submit}
        </PrimaryButton>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground-soft transition-colors hover:bg-accent disabled:opacity-50"
        >
          {COPY.review.back}
        </button>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  className,
  type = "button",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}
