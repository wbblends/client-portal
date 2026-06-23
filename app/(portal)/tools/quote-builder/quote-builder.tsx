"use client";

/**
 * Quote Builder — the multi-step flow.
 *
 *   1. Welcome      — branded intro card.
 *   2. Type         — Capsules / Powder / Liquid (or "let the AI decide").
 *   3. Upload       — drop in emails, specs, sheets. The more, the better.
 *   4. Analyzing    — Claude reads everything and pre-fills the quote.
 *   5. Review       — the editable, pre-filled form (quote-form.tsx).
 *   6. Done         — the finished PDF downloads.
 *
 * Styling intentionally echoes the public Customer Experience Survey: a soft
 * brand wash, frosted cards, big display headings, primary pill buttons.
 * Progress autosaves to localStorage so a rep can close the tab and resume
 * (uploaded files aren't persisted — those are re-added on resume).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Pill,
  Wheat,
  FlaskConical,
  UploadCloud,
  FileText,
  X,
  Sparkles,
  Loader2,
  Download,
  CheckCircle2,
  RefreshCw,
  Mail,
  AlertCircle,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import {
  emptyQuoteData,
  type QuoteData,
  type Ingredient,
  type ProductType,
} from "@/lib/quote-builder/types";
import { applyExtracted } from "@/lib/quote-builder/merge";
import { QuoteForm, productTypeLabel } from "./quote-form";

type Phase = "welcome" | "type" | "upload" | "analyzing" | "form" | "done";

const STORAGE_KEY = "wbb.quote-builder.v1";
/** Keep each analyze request comfortably under the serverless body limit. */
const MAX_BATCH_BYTES = 3.3 * 1024 * 1024;

type Persisted = {
  phase: Phase;
  data: QuoteData;
  summary: string;
  confidence: string;
};

const TYPE_CARDS: { type: ProductType; icon: typeof Pill; blurb: string }[] = [
  { type: "capsule", icon: Pill, blurb: "Capsules & tablets" },
  { type: "powder", icon: Wheat, blurb: "Drink mixes & loose powders" },
  { type: "liquid", icon: FlaskConical, blurb: "Tinctures, syrups, oils" },
];

export function QuoteBuilder() {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [data, setData] = useState<QuoteData>(() => emptyQuoteData("capsule"));
  const [files, setFiles] = useState<File[]>([]);
  const [summary, setSummary] = useState("");
  const [confidence, setConfidence] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const hydrated = useRef(false);

  // ── Restore ──
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Persisted;
        if (saved?.data) {
          setData({ ...emptyQuoteData(saved.data.productType), ...saved.data });
          setSummary(saved.summary ?? "");
          setConfidence(saved.confidence ?? "");
          // Resume on the form if they'd gotten that far; otherwise start fresh
          // at welcome (uploaded files can't be restored).
          if (saved.phase === "form" || saved.phase === "done") setPhase("form");
        }
      }
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  // ── Persist ──
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      const payload: Persisted = { phase, data, summary, confidence };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota */
    }
  }, [phase, data, summary, confidence]);

  const set = useCallback(<K extends keyof QuoteData>(key: K, value: QuoteData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  }, []);

  const setIngredient = useCallback((i: number, key: keyof Ingredient, value: string) => {
    setData((d) => {
      const ingredients = d.ingredients.map((row, j) =>
        j === i ? { ...row, [key]: value } : row,
      );
      return { ...d, ingredients };
    });
  }, []);

  const setIngredients = useCallback((rows: Ingredient[]) => {
    setData((d) => ({ ...d, ingredients: rows.length ? rows : d.ingredients }));
  }, []);

  const chooseType = useCallback((type: ProductType) => {
    setData((d) => ({ ...d, productType: type }));
    setPhase("upload");
  }, []);

  // ── Analyze uploads ──
  const analyze = useCallback(async () => {
    setError(null);
    if (files.length === 0) {
      setPhase("form");
      return;
    }
    setPhase("analyzing");

    // Bin-pack files into request-sized batches.
    const batches: File[][] = [];
    let cur: File[] = [];
    let curBytes = 0;
    for (const f of [...files].sort((a, b) => b.size - a.size)) {
      if (cur.length && curBytes + f.size > MAX_BATCH_BYTES) {
        batches.push(cur);
        cur = [];
        curBytes = 0;
      }
      cur.push(f);
      curBytes += f.size;
    }
    if (cur.length) batches.push(cur);

    setProgress({ done: 0, total: batches.length });

    let merged = emptyQuoteData(data.productType);
    const summaries: string[] = [];
    const allIngredients: Ingredient[][] = [];
    let detected: ProductType | "" = "";
    let firstConfidence = "";
    let anyOk = false;
    const failures: string[] = [];

    for (let b = 0; b < batches.length; b++) {
      const fd = new FormData();
      fd.append("productHint", data.productType);
      for (const f of batches[b]) fd.append("files", f, f.name);
      try {
        const res = await fetch("/api/tools/quote-builder/analyze", {
          method: "POST",
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          failures.push(json?.error || `Batch ${b + 1} failed.`);
        } else {
          anyOk = true;
          const fields = (json.fields ?? {}) as Record<string, unknown>;
          if (Array.isArray(fields.ingredients))
            allIngredients.push(fields.ingredients as Ingredient[]);
          merged = applyExtracted(merged, { ...fields, ingredients: undefined });
          if (json.summary) summaries.push(json.summary as string);
          if (!detected && json.detectedProductType) detected = json.detectedProductType;
          if (!firstConfidence && json.confidence) firstConfidence = json.confidence;
        }
      } catch {
        failures.push(`Batch ${b + 1} couldn't be sent (it may be too large).`);
      }
      setProgress({ done: b + 1, total: batches.length });
    }

    // Best ingredient list = the one with the most named rows.
    const best = allIngredients
      .filter((rows) => Array.isArray(rows))
      .sort(
        (a, b) =>
          b.filter((r) => r?.name).length - a.filter((r) => r?.name).length,
      )[0];
    if (best) merged = applyExtracted(merged, { ingredients: best });

    // Keep the rep's chosen type; the model's detection is a fallback/FYI.
    merged.productType = data.productType;
    setData(merged);
    setConfidence(firstConfidence);
    setSummary(
      [
        summaries.join("\n\n"),
        detected && detected !== data.productType
          ? `Note: the materials look more like a ${productTypeLabel(detected)} product — switch the type above if that's right.`
          : "",
        failures.length ? `Couldn't read: ${failures.join(" ")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
    if (!anyOk && failures.length) {
      setError(failures.join(" ") + " You can still fill the quote in by hand.");
    }
    setPhase("form");
  }, [files, data.productType]);

  // ── Generate PDF ──
  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/quote-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productType: data.productType, data }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Could not generate the PDF.");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="?([^"]+)"?/.exec(cd);
      const filename = m ? m[1] : `${data.brand || "WB Blends"} Quote.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the PDF.");
    } finally {
      setGenerating(false);
    }
  }, [data]);

  const startOver = useCallback(() => {
    setData(emptyQuoteData("capsule"));
    setFiles([]);
    setSummary("");
    setConfidence("");
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
      {phase === "welcome" && <Welcome onStart={() => setPhase("type")} />}

      {phase === "type" && (
        <TypeStep
          onPick={chooseType}
          onAuto={() => {
            // Let the uploads decide; default capsule until the AI suggests.
            setData((d) => ({ ...d, productType: "capsule" }));
            setPhase("upload");
          }}
        />
      )}

      {phase === "upload" && (
        <UploadStep
          files={files}
          setFiles={setFiles}
          onBack={() => setPhase("type")}
          onAnalyze={analyze}
          error={error}
        />
      )}

      {phase === "analyzing" && <Analyzing progress={progress} count={files.length} />}

      {phase === "form" && (
        <ReviewStep
          data={data}
          set={set}
          setIngredient={setIngredient}
          setIngredients={setIngredients}
          summary={summary}
          confidence={confidence}
          generating={generating}
          error={error}
          onGenerate={generate}
          onBack={() => setPhase("upload")}
        />
      )}

      {phase === "done" && (
        <Done brand={data.brand} product={data.product} onAgain={startOver} onEdit={() => setPhase("form")} />
      )}
    </Shell>
  );
}

// ─── Shell + brand wash ─────────────────────────────────────────────────────

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
      <div className="relative mx-auto w-full max-w-[860px] px-4 py-8 sm:px-6">
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
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground-soft transition-colors hover:bg-accent disabled:opacity-50",
        className,
      )}
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

// ─── Screens ────────────────────────────────────────────────────────────────

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="flex w-full max-w-[560px] flex-col items-center rounded-3xl border border-white/50 bg-card/70 px-6 py-12 text-center shadow-[0_30px_80px_-30px_rgba(17,11,41,0.25)] ring-1 ring-inset ring-white/40 backdrop-blur-xl sm:px-12">
        <Logo size="lg" />
        <h1 className="mt-5 font-display text-[clamp(34px,6vw,52px)] leading-[1.05] tracking-tight text-foreground">
          Quote Builder
        </h1>
        <p className="mt-4 max-w-[420px] text-base leading-relaxed text-muted">
          Drop in whatever the customer sent — emails, specs, spreadsheets — and
          we&apos;ll read it all and pre-fill the WB Blends quote for you. Review,
          tweak, and download the finished PDF in a couple of minutes.
        </p>
        <PrimaryButton className="mt-8" onClick={onStart}>
          Start a quote
          <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </div>
  );
}

function TypeStep({
  onPick,
  onAuto,
}: {
  onPick: (t: ProductType) => void;
  onAuto: () => void;
}) {
  return (
    <div>
      <Header step={1} title="What are we quoting?" subtitle="This picks the right quote form. You can change it later." />
      <div className="grid gap-4 sm:grid-cols-3">
        {TYPE_CARDS.map(({ type, icon: Icon, blurb }) => (
          <button
            key={type}
            type="button"
            onClick={() => onPick(type)}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-5 py-8 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[var(--shadow-card-hover)]"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="h-7 w-7" />
            </span>
            <span className="font-display text-xl text-foreground">{productTypeLabel(type)}</span>
            <span className="text-xs text-muted">{blurb}</span>
          </button>
        ))}
      </div>
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onAuto}
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Not sure yet — I&apos;ll add files and let the AI suggest
        </button>
      </div>
    </div>
  );
}

function UploadStep({
  files,
  setFiles,
  onBack,
  onAnalyze,
  error,
}: {
  files: File[];
  setFiles: (f: File[]) => void;
  onBack: () => void;
  onAnalyze: () => void;
  error: string | null;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    // De-dupe by name+size.
    const seen = new Set(files.map((f) => f.name + f.size));
    const merged = [...files];
    for (const f of incoming) if (!seen.has(f.name + f.size)) merged.push(f);
    setFiles(merged);
  };

  return (
    <div>
      <Header
        step={2}
        title="Add anything you have"
        subtitle="The more you give it, the more it fills in. Nothing here is required — skip it and fill the form yourself if you'd rather."
      />

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-info-soft bg-info-soft/50 px-4 py-3 text-sm text-foreground-soft">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          <strong className="font-semibold text-foreground">Tip:</strong> drag emails
          straight from your Outlook inbox right onto this box — no need to save them
          first. Product specs, formulas, COAs, Word docs, and Excel sheets all work too.
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          drag ? "border-primary bg-primary-soft" : "border-border-strong bg-card hover:border-primary hover:bg-accent",
        )}
      >
        <UploadCloud className="h-9 w-9 text-primary" />
        <p className="mt-3 text-sm font-semibold text-foreground">
          Drop files here or click to browse
        </p>
        <p className="mt-1 text-xs text-muted">
          PDF, images, Word, Excel, .msg / .eml emails — as many as you like
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {files.map((f, i) => (
            <li
              key={f.name + f.size + i}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-soft">{prettySize(f.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-soft hover:bg-danger-soft hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GhostButton onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </GhostButton>
        <div className="flex flex-col gap-3 sm:flex-row">
          <GhostButton onClick={onAnalyze}>Skip — I&apos;ll fill it in</GhostButton>
          <PrimaryButton onClick={onAnalyze} disabled={files.length === 0}>
            <Sparkles className="h-4 w-4" />
            Analyze &amp; pre-fill
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function Analyzing({
  progress,
  count,
}: {
  progress: { done: number; total: number };
  count: number;
}) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <span className="relative flex h-16 w-16 items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary/30" />
        <Sparkles className="absolute h-6 w-6 text-primary" />
      </span>
      <h2 className="mt-6 font-display text-2xl text-foreground">Reading your materials…</h2>
      <p className="mt-2 max-w-[380px] text-sm text-muted">
        Digesting {count} {count === 1 ? "file" : "files"} and filling in the quote. This
        usually takes a few seconds.
      </p>
      {progress.total > 1 && (
        <p className="mt-3 text-xs font-semibold text-primary">
          Batch {progress.done} of {progress.total}
        </p>
      )}
    </div>
  );
}

function ReviewStep({
  data,
  set,
  setIngredient,
  setIngredients,
  summary,
  confidence,
  generating,
  error,
  onGenerate,
  onBack,
}: {
  data: QuoteData;
  set: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void;
  setIngredient: (i: number, key: keyof Ingredient, value: string) => void;
  setIngredients: (rows: Ingredient[]) => void;
  summary: string;
  confidence: string;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onBack: () => void;
}) {
  return (
    <div className="pb-24">
      <Header step={3} title="Review &amp; finish" subtitle="Everything the AI could fill in is below — check it, fix anything, and generate the PDF." />

      {/* Product-type switcher — the rep can always correct the format. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <span className="text-xs font-semibold text-muted">Quote form:</span>
        {TYPE_CARDS.map(({ type, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => set("productType", type)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
              data.productType === type
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface text-foreground-soft hover:border-border-strong",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {productTypeLabel(type)}
          </button>
        ))}
      </div>

      {summary && (
        <div className="mb-4 rounded-2xl border border-primary/20 bg-primary-soft/40 p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wide text-primary">
              AI summary{confidence ? ` · ${confidence} confidence` : ""}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground-soft">{summary}</p>
        </div>
      )}

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <QuoteForm data={data} set={set} setIngredient={setIngredient} setIngredients={setIngredients} />

      {/* Floating action island — auto-width and centered over the content
          area so it doesn't span the full viewport or sit on top of the
          left sidebar. pointer-events-none on the wrapper lets clicks pass
          through the empty gutters to the form behind it. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-border bg-card/95 p-1.5 shadow-[0_12px_40px_-12px_rgba(17,11,41,0.4)] backdrop-blur supports-[backdrop-filter]:bg-card/85">
          <GhostButton onClick={onBack} disabled={generating} className="h-10 px-4">
            <ArrowLeft className="h-4 w-4" /> Back
          </GhostButton>
          <PrimaryButton onClick={onGenerate} disabled={generating} className="h-10 px-5">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Building PDF…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Generate filled PDF
              </>
            )}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function Done({
  brand,
  product,
  onAgain,
  onEdit,
}: {
  brand: string;
  product: string;
  onAgain: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckCircle2 className="h-9 w-9" />
      </span>
      <h1 className="mt-6 font-display text-[clamp(28px,5vw,40px)] tracking-tight text-foreground">
        Your quote is ready
      </h1>
      <p className="mt-3 max-w-[420px] text-base text-muted">
        The filled PDF{brand ? ` for ${brand}` : ""}{product ? ` — ${product}` : ""} just
        downloaded. Didn&apos;t catch it? Re-open the review step and generate again.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <PrimaryButton onClick={onEdit}>
          <ArrowLeft className="h-4 w-4" /> Back to review
        </PrimaryButton>
        <GhostButton onClick={onAgain}>
          <RefreshCw className="h-4 w-4" /> Start another quote
        </GhostButton>
      </div>
    </div>
  );
}

// ─── Chrome ─────────────────────────────────────────────────────────────────

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
      <p className="mt-2 max-w-[560px] text-sm leading-relaxed text-muted">{subtitle}</p>
    </div>
  );
}

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
