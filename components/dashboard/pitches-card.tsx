import { ArrowRight } from "lucide-react";
import type { Pitch } from "@/lib/data/types";

export function PitchesCard({ pitches }: { pitches: Pitch[] }) {
  return (
    <div className="divide-y divide-border">
      {pitches.map(p => (
        <article key={p.id} className="py-5 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {p.category}
          </div>
          <h4 className="mt-2 text-base font-bold text-foreground">{p.title}</h4>
          <p className="mt-1.5 text-base text-foreground-soft leading-relaxed">{p.blurb}</p>
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="rounded-md bg-accent px-2.5 py-1 text-sm font-semibold text-foreground-soft">
              {p.highlight}
            </span>
            {p.cta && (
              <a
                href="#"
                className="inline-flex items-center gap-1.5 text-base font-semibold text-primary underline underline-offset-4 hover:text-primary-hover"
              >
                {p.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
