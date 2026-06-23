"use client";

/**
 * Brand Researcher — the multi-step flow.
 *
 *   1. Welcome   — branded intro card explaining the tool.
 *   2. Identify  — rep types a brand; we web-search to pin down the company.
 *   3. Confirm   — chat-style "is this the right brand?" card before we spend
 *                  real research time. Rep can refine or pick an alternative.
 *   4. Research  — Claude does deep, multi-round web research; the report
 *                  streams in live with a running view of what it's searching.
 *   5. Report    — the finished, cited brief. Copy, print, or research another.
 *
 * Styling echoes the Quote Builder: soft brand wash, frosted cards, display
 * headings, pill buttons. The last finished report is cached to localStorage
 * so a rep can close the tab and reopen it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Telescope,
  Search,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Sparkles,
  Check,
  RefreshCw,
  Copy,
  Printer,
  AlertCircle,
  Globe,
  CornerDownLeft,
  Building2,
  Clock,
  DollarSign,
  CircleUserRound,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";
import type { BrandCandidate } from "@/lib/brand-researcher/prompts";
import type { CrmLookup } from "@/lib/brand-researcher/hubspot-lookup";

type Phase = "welcome" | "identify" | "confirm" | "research" | "report";

const STORAGE_KEY = "wbb.brand-researcher.v1";

type Persisted = {
  candidate: BrandCandidate | null;
  report: string;
};

export function BrandResearcher({ canSeeCrm = false }: { canSeeCrm?: boolean }) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [brand, setBrand] = useState("");
  const [context, setContext] = useState("");
  const [candidate, setCandidate] = useState<BrandCandidate | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crm, setCrm] = useState<CrmLookup | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);

  const [report, setReport] = useState("");
  const [activity, setActivity] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [researching, setResearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const hydrated = useRef(false);

  // ── Restore a previous finished report ──
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Persisted;
        if (saved?.report && saved.candidate) {
          setCandidate(saved.candidate);
          setReport(saved.report);
          setPhase("report");
        }
      }
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  const persist = useCallback((c: BrandCandidate | null, r: string) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ candidate: c, report: r } satisfies Persisted),
      );
    } catch {
      /* ignore quota */
    }
  }, []);

  // ── Check whether the brand is already in our HubSpot ──
  const loadCrm = useCallback(
    async (c: BrandCandidate) => {
      if (!canSeeCrm || !c.name) return;
      setCrm(null);
      setCrmLoading(true);
      try {
        const res = await fetch("/api/tools/brand-researcher/hubspot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: c.name, website: c.website }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.lookup) setCrm(json.lookup as CrmLookup);
        else setCrm({ configured: true, error: json?.error || "HubSpot lookup failed." });
      } catch {
        setCrm({ configured: true, error: "Couldn't reach HubSpot." });
      } finally {
        setCrmLoading(false);
      }
    },
    [canSeeCrm],
  );

  // ── Identify / confirm the brand ──
  const identify = useCallback(
    async (clarification = "") => {
      const name = brand.trim();
      if (!name) return;
      setError(null);
      setIdentifying(true);
      try {
        const res = await fetch("/api/tools/brand-researcher/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand: name, clarification }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Couldn't identify that brand.");
        const c = json.candidate as BrandCandidate;
        setCandidate(c);
        setPhase("confirm");
        void loadCrm(c);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't identify that brand.");
      } finally {
        setIdentifying(false);
      }
    },
    [brand, loadCrm],
  );

  // ── Run the deep research stream ──
  const research = useCallback(async () => {
    if (!candidate) return;
    setError(null);
    setReport("");
    setActivity([]);
    setCurrent("");
    setResearching(true);
    setPhase("research");

    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";

    try {
      const res = await fetch("/api/tools/brand-researcher/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidate.name,
          website: candidate.website,
          context,
          crm: canSeeCrm ? crm : undefined,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Research couldn't start.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (evt.type === "text") {
            acc += String(evt.delta ?? "");
            setReport(acc);
          } else if (evt.type === "search") {
            const q = `Searching: ${evt.query}`;
            setCurrent(q);
            setActivity((a) => [q, ...a].slice(0, 8));
          } else if (evt.type === "fetch") {
            const q = `Reading: ${prettyUrl(String(evt.url))}`;
            setCurrent(q);
            setActivity((a) => [q, ...a].slice(0, 8));
          } else if (evt.type === "error") {
            throw new Error(String(evt.message ?? "Research failed."));
          } else if (evt.type === "done") {
            // handled after the loop
          }
        }
      }

      if (!acc.trim()) throw new Error("No report came back. Try again.");
      persist(candidate, acc);
      setPhase("report");
    } catch (err) {
      if (controller.signal.aborted) return; // user cancelled — stay put
      setError(err instanceof Error ? err.message : "Research failed.");
      // Keep whatever streamed so far visible on the report screen if any.
      if (acc.trim()) {
        persist(candidate, acc);
        setPhase("report");
      } else {
        setPhase("confirm");
      }
    } finally {
      setResearching(false);
      abortRef.current = null;
    }
  }, [candidate, context, persist, crm, canSeeCrm]);

  const cancelResearch = useCallback(() => {
    abortRef.current?.abort();
    setResearching(false);
    setPhase("confirm");
  }, []);

  const startOver = useCallback(() => {
    abortRef.current?.abort();
    setBrand("");
    setContext("");
    setCandidate(null);
    setCrm(null);
    setReport("");
    setActivity([]);
    setCurrent("");
    setError(null);
    setPhase("welcome");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <Shell>
      {phase === "welcome" && <Welcome onStart={() => setPhase("identify")} />}

      {phase === "identify" && (
        <IdentifyStep
          brand={brand}
          setBrand={setBrand}
          context={context}
          setContext={setContext}
          identifying={identifying}
          error={error}
          onIdentify={() => identify()}
        />
      )}

      {phase === "confirm" && candidate && (
        <ConfirmStep
          candidate={candidate}
          context={context}
          setContext={setContext}
          identifying={identifying}
          error={error}
          crm={crm}
          crmLoading={crmLoading}
          onResearch={research}
          onRefine={(clar) => identify(clar)}
          onBack={() => setPhase("identify")}
        />
      )}

      {phase === "research" && candidate && (
        <ResearchStep
          name={candidate.name}
          current={current}
          activity={activity}
          report={report}
          onCancel={cancelResearch}
        />
      )}

      {phase === "report" && candidate && (
        <ReportStep
          candidate={candidate}
          report={report}
          error={error}
          crm={crm}
          onAgain={startOver}
          onRerun={research}
          researching={researching}
        />
      )}
    </Shell>
  );
}

// ─── Shell + chrome ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100dvh-7rem)] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(48rem 32rem at 85% -5%, color-mix(in oklab, var(--color-primary) 13%, transparent), transparent 60%), radial-gradient(40rem 28rem at 0% 105%, color-mix(in oklab, var(--color-primary) 8%, transparent), transparent 60%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-[880px] px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground-soft transition-colors hover:bg-accent disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Header({
  step,
  title,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1.5 rounded-full transition-all",
              n === step ? "w-8 bg-primary" : n < step ? "w-4 bg-primary/50" : "w-4 bg-border",
            )}
          />
        ))}
      </div>
      <h1 className="font-display text-[clamp(26px,4.5vw,38px)] leading-tight tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 max-w-[600px] text-sm leading-relaxed text-muted">{subtitle}</p>
    </div>
  );
}

// ─── Screens ────────────────────────────────────────────────────────────────

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="flex w-full max-w-[600px] flex-col items-center rounded-3xl border border-white/50 bg-card/70 px-6 py-12 text-center shadow-[0_30px_80px_-30px_rgba(17,11,41,0.25)] ring-1 ring-inset ring-white/40 backdrop-blur-xl sm:px-12">
        <Logo size="lg" />
        <span className="mt-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Telescope className="h-7 w-7" />
        </span>
        <h1 className="mt-5 font-display text-[clamp(32px,6vw,48px)] leading-[1.05] tracking-tight text-foreground">
          Brand Researcher
        </h1>
        <p className="mt-4 max-w-[460px] text-base leading-relaxed text-muted">
          Name a brand and we&apos;ll confirm exactly who they are, then dig deep —
          estimated revenue and manufacturing spend, who they likely co-pack with,
          the people to know on LinkedIn, recent news and funding, and a
          recommended way in.
        </p>
        <PrimaryButton className="mt-8" onClick={onStart}>
          Research a brand
          <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
        <p className="mt-4 text-xs text-muted-soft">
          Live web research · usually takes a minute or two
        </p>
      </div>
    </div>
  );
}

function IdentifyStep({
  brand,
  setBrand,
  context,
  setContext,
  identifying,
  error,
  onIdentify,
}: {
  brand: string;
  setBrand: (v: string) => void;
  context: string;
  setContext: (v: string) => void;
  identifying: boolean;
  error: string | null;
  onIdentify: () => void;
}) {
  return (
    <div>
      <Header
        step={1}
        title="Which brand?"
        subtitle="Type the brand or company name. We'll search the web and confirm we've got the right one before doing the deep dive."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!identifying) onIdentify();
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-soft" />
          <input
            autoFocus
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Physician's Choice"
            className="h-14 w-full rounded-2xl border border-border-strong bg-card pl-12 pr-4 text-base text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-soft focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">
            Anything you already know? <span className="font-normal">(optional — helps us nail the right company and tailor the angle)</span>
          </span>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
            placeholder="e.g. The probiotics brand on Amazon, HQ in Utah. We met their ops lead at Expo West."
            className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-soft focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </label>

        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

        <div className="mt-6 flex justify-end">
          <PrimaryButton type="submit" disabled={!brand.trim() || identifying}>
            {identifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Finding them…
              </>
            ) : (
              <>
                Find this brand <ArrowRight className="h-4 w-4" />
              </>
            )}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: BrandCandidate["confidence"] }) {
  const map = {
    high: "bg-success-soft text-success",
    medium: "bg-primary-soft text-primary",
    low: "bg-accent text-foreground-soft",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        map[confidence],
      )}
    >
      {confidence} confidence
    </span>
  );
}

function ConfirmStep({
  candidate,
  context,
  setContext,
  identifying,
  error,
  crm,
  crmLoading,
  onResearch,
  onRefine,
  onBack,
}: {
  candidate: BrandCandidate;
  context: string;
  setContext: (v: string) => void;
  identifying: boolean;
  error: string | null;
  crm: CrmLookup | null;
  crmLoading: boolean;
  onResearch: () => void;
  onRefine: (clarification: string) => void;
  onBack: () => void;
}) {
  const [refine, setRefine] = useState("");

  return (
    <div>
      <Header
        step={2}
        title="Is this the right brand?"
        subtitle="We'll only run the deep research once you confirm. Not quite right? Add a detail or pick an alternative below."
      />

      <div className="rounded-3xl border border-white/50 bg-card/80 p-6 shadow-[0_20px_60px_-30px_rgba(17,11,41,0.25)] ring-1 ring-inset ring-white/40 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl tracking-tight text-foreground">
              {candidate.name || "Unknown brand"}
            </h2>
            {candidate.category && (
              <p className="mt-0.5 text-sm font-medium text-primary">{candidate.category}</p>
            )}
          </div>
          <ConfidenceBadge confidence={candidate.confidence} />
        </div>

        {candidate.oneLiner && (
          <p className="mt-3 text-[15px] leading-relaxed text-foreground-soft">
            {candidate.oneLiner}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
          {candidate.website && (
            <a
              href={normalizeUrl(candidate.website)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <Globe className="h-4 w-4" />
              {prettyUrl(candidate.website)}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {candidate.hq && (
            <span className="inline-flex items-center gap-1.5">{candidate.hq}</span>
          )}
        </div>

        {candidate.question && (
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary-soft/40 p-3.5 text-sm text-foreground-soft">
            <span className="font-semibold text-primary">Quick check: </span>
            {candidate.question}
          </div>
        )}

        {candidate.alternatives.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-muted">
              Did you mean one of these instead?
            </p>
            <div className="flex flex-col gap-2">
              {candidate.alternatives.map((alt, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={identifying}
                  onClick={() => onRefine(`I mean ${alt.name} — ${alt.hint}`)}
                  className="flex items-start gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left text-sm transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
                >
                  <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-soft" />
                  <span>
                    <span className="font-semibold text-foreground">{alt.name}</span>
                    <span className="text-muted"> — {alt.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <CrmPanel crm={crm} loading={crmLoading} />

      {/* Optional context the rep wants the research to weigh */}
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-semibold text-muted">
          What are you hoping to get out of this? <span className="font-normal">(optional)</span>
        </span>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
          placeholder="e.g. We make capsules & gummies and want to win their NPD pipeline. Looking for the supply-chain decision maker."
          className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-soft focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>

      {/* Manual refine */}
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (refine.trim() && !identifying) {
            onRefine(refine.trim());
            setRefine("");
          }
        }}
      >
        <div className="relative">
          <input
            value={refine}
            onChange={(e) => setRefine(e.target.value)}
            placeholder="Not them? Add a detail to narrow it down…"
            className="h-12 w-full rounded-xl border border-border bg-card pl-4 pr-12 text-sm text-foreground outline-none transition-colors placeholder:text-muted-soft focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          <button
            type="submit"
            disabled={!refine.trim() || identifying}
            aria-label="Refine"
            className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-soft transition-colors hover:bg-accent hover:text-primary disabled:opacity-40"
          >
            {identifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CornerDownLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>

      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GhostButton onClick={onBack} disabled={identifying}>
          <ArrowLeft className="h-4 w-4" /> Start a different brand
        </GhostButton>
        <PrimaryButton onClick={onResearch} disabled={identifying || !candidate.name}>
          <Sparkles className="h-4 w-4" />
          Yes — research them
        </PrimaryButton>
      </div>
    </div>
  );
}

function ResearchStep({
  name,
  current,
  activity,
  report,
  onCancel,
}: {
  name: string;
  current: string;
  activity: string[];
  report: string;
  onCancel: () => void;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  // Keep the latest streamed content in view.
  useEffect(() => {
    reportRef.current?.scrollTo({ top: reportRef.current.scrollHeight });
  }, [report]);

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl tracking-tight text-foreground">
            <span className="relative flex h-9 w-9 items-center justify-center">
              <Loader2 className="h-9 w-9 animate-spin text-primary/30" />
              <Telescope className="absolute h-[18px] w-[18px] text-primary" />
            </span>
            Researching {name}…
          </h1>
          <p className="mt-1.5 min-h-[20px] text-sm font-medium text-primary">
            {current || "Reading the web…"}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground-soft transition-colors hover:bg-accent"
        >
          Stop
        </button>
      </div>

      {/* Recent search trail */}
      {activity.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {activity.map((a, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-xs",
                i === 0
                  ? "border-primary/30 bg-primary-soft text-primary"
                  : "border-border bg-card text-muted",
              )}
            >
              <Search className="h-3 w-3 shrink-0" />
              <span className="truncate">{a.replace(/^(Searching|Reading): /, "")}</span>
            </span>
          ))}
        </div>
      )}

      {report ? (
        <div
          ref={reportRef}
          className="max-h-[58vh] overflow-y-auto rounded-2xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur-sm sm:p-7"
        >
          <Markdown>{report}</Markdown>
          <span className="mt-2 inline-block h-4 w-2 animate-pulse bg-primary/60 align-middle" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-card/50 px-6 py-16 text-center">
          <Sparkles className="h-8 w-8 text-primary/60" />
          <p className="mt-3 max-w-[360px] text-sm text-muted">
            Combing the web for revenue, manufacturing, key people, and news.
            The brief will start writing itself here in a moment.
          </p>
        </div>
      )}
    </div>
  );
}

function ReportStep({
  candidate,
  report,
  error,
  crm,
  onAgain,
  onRerun,
  researching,
}: {
  candidate: BrandCandidate;
  report: string;
  error: string | null;
  crm: CrmLookup | null;
  onAgain: () => void;
  onRerun: () => void;
  researching: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="pb-10">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Brand intelligence brief
          </p>
          <h1 className="font-display text-[clamp(24px,4vw,34px)] tracking-tight text-foreground">
            {candidate.name}
          </h1>
          {candidate.website && (
            <a
              href={normalizeUrl(candidate.website)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Globe className="h-3.5 w-3.5" />
              {prettyUrl(candidate.website)}
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-semibold text-foreground-soft transition-colors hover:bg-accent"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-semibold text-foreground-soft transition-colors hover:bg-accent"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <CrmPanel crm={crm} loading={false} />

      <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <Markdown>{report}</Markdown>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GhostButton onClick={onAgain}>
          <RefreshCw className="h-4 w-4" /> Research another brand
        </GhostButton>
        <GhostButton onClick={onRerun} disabled={researching}>
          <Sparkles className="h-4 w-4" /> Re-run this research
        </GhostButton>
      </div>
    </div>
  );
}

// ─── CRM (HubSpot) panel ────────────────────────────────────────────────────

function CrmPanel({ crm, loading }: { crm: CrmLookup | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Checking HubSpot…
      </div>
    );
  }
  if (!crm || !crm.configured) return null;

  if ("error" in crm) {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted">
        HubSpot check unavailable — {crm.error}
      </div>
    );
  }

  if (!crm.inHubspot) {
    return (
      <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-info-soft bg-info-soft/40 px-4 py-3 text-sm">
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-foreground-soft">
          <strong className="font-semibold text-foreground">Net-new account</strong> — not
          in our HubSpot yet.
        </span>
      </div>
    );
  }

  const { company, deals } = crm;
  const openDeals = deals.filter((d) => !d.isClosed).length;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-success/30 bg-success-soft/30">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-success/20 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Building2 className="h-4 w-4 text-success" />
          Already in HubSpot
          {openDeals > 0 && (
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success">
              {openDeals} open deal{openDeals === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <a
          href={company.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Open in HubSpot <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1.5 px-4 py-3 text-sm">
        {company.owner && (
          <span className="inline-flex items-center gap-1.5 text-foreground-soft">
            <CircleUserRound className="h-4 w-4 text-muted-soft" />
            Owner: <strong className="font-semibold text-foreground">{company.owner.name}</strong>
          </span>
        )}
        {company.lifecycleStage && (
          <span className="text-muted">
            Stage: <span className="text-foreground-soft">{company.lifecycleStage}</span>
          </span>
        )}
        {company.lastActivity && (
          <span className="inline-flex items-center gap-1.5 text-muted">
            <Clock className="h-3.5 w-3.5 text-muted-soft" />
            Last activity {fmtDate(company.lastActivity)}
          </span>
        )}
      </div>

      {deals.length > 0 && (
        <ul className="space-y-2 border-t border-success/15 px-4 py-3">
          {deals.slice(0, 6).map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-card/70 px-3 py-2 text-sm"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  d.isClosed ? (d.isWon ? "bg-success" : "bg-muted-soft") : "bg-primary",
                )}
                aria-hidden
              />
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate font-medium text-foreground hover:text-primary hover:underline"
              >
                {d.name}
              </a>
              <span className="text-xs text-muted">{d.pipeline}</span>
              <span className="text-xs font-medium text-foreground-soft">{d.stage}</span>
              {d.amount != null && (
                <span className="inline-flex items-center text-xs font-semibold text-foreground">
                  <DollarSign className="h-3 w-3" />
                  {Math.round(d.amount).toLocaleString()}
                </span>
              )}
              {d.owner && <span className="text-xs text-muted">· {d.owner.name}</span>}
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  d.isClosed
                    ? d.isWon
                      ? "bg-success-soft text-success"
                      : "bg-accent text-muted"
                    : "bg-primary-soft text-primary",
                )}
              >
                {d.isClosed ? (d.isWon ? "Won" : "Closed") : "Open"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return "#";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function prettyUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}
