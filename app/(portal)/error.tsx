"use client";

import { useEffect } from "react";

/**
 * Error boundary for any authenticated portal route. Renders inside the
 * sidebar/nav chrome so the user keeps their context. Falls through to
 * `app/error.tsx` for anything thrown above the (portal) segment.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[(portal)/error] Unhandled error:", error);
  }, [error]);

  return (
    <div className="page-container page-pad-x page-pad-y">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <h1 className="font-display text-2xl tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted">
          We hit an unexpected error loading this page. The portal team has been notified.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-muted-soft">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground-soft hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
