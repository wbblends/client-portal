import { ArrowRight } from "lucide-react";
import type { Pitch } from "@/lib/data/types";

export function PitchesCard({ pitches }: { pitches: Pitch[] }) {
  return (
    <div className="divide-y divide-border">
      {pitches.map(p => (
        <article key={p.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <span className="h-1 w-1 rounded-full bg-primary" />
            {p.category}
          </div>
          <h4 className="mt-1.5 text-sm font-semibold text-foreground">{p.title}</h4>
          <p className="mt-1 text-sm text-muted">{p.blurb}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-foreground-soft">
              {p.highlight}
            </span>
            {p.cta && (
              <a
                href="#"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
              >
                {p.cta}
                <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
