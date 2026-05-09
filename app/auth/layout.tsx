import { Logo } from "@/components/ui/logo";

/**
 * Shared shell for the public auth flows (set-password, forgot, reset).
 * Visually consistent with /login but stripped down — no value-prop column,
 * just a centered card. Pages provide their own heading + form inside.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 88% 10%, color-mix(in oklab, var(--color-primary) 16%, transparent), transparent 65%), radial-gradient(50rem 36rem at 6% 95%, color-mix(in oklab, var(--color-primary) 9%, transparent), transparent 60%)",
        }}
      />

      <div className="relative flex min-h-dvh flex-col px-6 py-8 lg:px-10 lg:py-10">
        <header className="mb-12 lg:mb-16">
          <Logo size="lg" />
        </header>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>

        <footer className="mt-10 flex items-center gap-2 text-[11px] text-muted-soft">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          All portal systems operational
        </footer>
      </div>
    </main>
  );
}
