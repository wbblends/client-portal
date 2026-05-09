import Link from "next/link";

/**
 * Root 404 page. Catches `notFound()` calls and unmatched URLs that fall
 * outside the (portal) segment (e.g. /login/foo or anything pre-auth). The
 * (portal) segment has its own not-found that renders inside the sidebar.
 */
export default function RootNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">404</p>
      <h1 className="mt-2 font-display text-2xl tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
      >
        Go home
      </Link>
    </main>
  );
}
