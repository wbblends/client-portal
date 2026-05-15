import Link from "next/link";

/**
 * 404 for authenticated portal routes — typed-bad URL, retired customer id,
 * dashboard slug not in the registry, etc. Renders inside the portal layout
 * so the user keeps their nav.
 */
export default function PortalNotFound() {
  return (
    <div className="page-container page-pad-x page-pad-y">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)] text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">404</p>
        <h1 className="mt-2 font-display text-2xl tracking-tight text-foreground">
          We couldn&apos;t find that page
        </h1>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
