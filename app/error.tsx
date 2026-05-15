"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary. Catches any uncaught error thrown in a server
 * or client component below `app/`. Has to be a client component because
 * Next.js wires up the `reset()` callback on the client.
 *
 * The (portal) segment has its own `error.tsx` so authenticated routes can
 * render the error inside the sidebar chrome; this top-level one is the
 * fallback for anything outside that segment (login page, root, etc.).
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error] Unhandled error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-dvh bg-surface text-foreground">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-2xl tracking-tight">Something went wrong</h1>
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
            {/* Native <a> on purpose: this is the root error boundary, so
                the router may itself be in a broken state. A hard navigation
                guarantees the app resets, where `<Link>` would soft-navigate
                and risk getting stuck. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground-soft hover:bg-accent"
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
