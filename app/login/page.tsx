import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isSafeNextPath } from "@/lib/utils";
import { LoginForm } from "./login-form";
import { SwirlBackground } from "./swirl-background";
import { Logo } from "@/components/ui/logo";

export const metadata = {
  title: "Sign In — WB Blends",
};

const valueProps = [
  "Live order status & promise dates",
  "Documents, invoices, and contacts in one place",
  "Direct line to your account team",
];

export default async function LoginPage(props: PageProps<"/login">) {
  const session = await getSession();
  const params = await props.searchParams;
  const rawNext = typeof params.next === "string" ? params.next : undefined;
  // `next` comes from the query string — only honor same-origin paths so we
  // can't be used as an open-redirect to an attacker-controlled site.
  const next = isSafeNextPath(rawNext) ? rawNext! : "/";
  if (session) redirect(next);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-surface">
      {/* Ambient brand wash — sits behind everything so the page reads as
          intentionally lit rather than flat white, even on mobile where the
          hero column is hidden. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 88% 10%, color-mix(in oklab, var(--color-primary) 16%, transparent), transparent 65%), radial-gradient(50rem 36rem at 6% 95%, color-mix(in oklab, var(--color-primary) 9%, transparent), transparent 60%)",
        }}
      />

      {/* Hairline brand accent across the very top edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-primary) 50%, transparent), transparent)",
        }}
      />

      <div className="relative grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(440px,520px)_1fr]">
        {/* ──────── Left: form column ──────── */}
        <div className="relative flex flex-col px-6 py-8 lg:px-10 lg:py-10">
          <header className="mb-12 lg:mb-16">
            <Logo size="lg" />
          </header>

          <div className="flex flex-1 items-center">
            <div className="w-full max-w-[400px]">
              <div className="mb-7">
                <h1 className="font-display text-[28px] leading-tight tracking-normal text-foreground">
                  Sign in
                </h1>
                <p className="mt-1.5 text-sm text-muted">
                  Welcome back. Use the credentials from your account manager.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-7 ring-1 ring-primary/[0.04] shadow-[0_1px_2px_rgba(21,16,43,0.04),0_20px_45px_-22px_rgba(110,91,254,0.22)]">
                <LoginForm next={next} />
              </div>

              <p className="mt-6 text-xs text-muted-soft">
                Don&apos;t have access yet? Reach out to your account manager
                and we&apos;ll get you set up.
              </p>
            </div>
          </div>

          <footer className="mt-10 flex items-center gap-2 text-[11px] text-muted-soft">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            All portal systems operational
          </footer>
        </div>

        {/* ──────── Right: brand hero ──────── */}
        <aside className="relative hidden lg:block">
          <div className="absolute inset-0 overflow-hidden">
            <SwirlBackground />

            {/* Tinted wash — pushes the swirl back so foreground text stays
                high-contrast while keeping the brand color story intact. */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--color-surface) 80%, transparent) 0%, color-mix(in oklab, var(--color-surface) 55%, transparent) 45%, color-mix(in oklab, var(--color-primary-soft) 50%, transparent) 100%)",
              }}
            />

            {/* Soft focal halo behind the headline area. */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(34rem 28rem at 38% 50%, color-mix(in oklab, white 55%, transparent), transparent 70%)",
              }}
            />

            {/* Faint grain for a premium print-like texture. */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
              }}
            />
          </div>

          <div className="relative flex h-full items-center px-12 xl:px-20">
            <div className="max-w-[520px]">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/40 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/80 backdrop-blur-md">
                <span className="h-1 w-1 rounded-full bg-primary" />
                Customer Portal
              </span>

              <h2 className="mt-6 font-display text-[56px] leading-[1.08] tracking-normal text-foreground xl:text-[64px]">
                Excellence in
                <br />
                Every <span className="text-primary italic">Blend</span>.
              </h2>

              <p className="mt-5 max-w-[440px] text-[16px] leading-relaxed text-foreground/75">
                Real-time visibility into your orders — promise dates,
                current production stage, and any flags, anytime.
              </p>

              <ul className="mt-9 space-y-3.5">
                {valueProps.map(item => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-[15px] text-foreground/85"
                  >
                    <span className="mt-[5px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/25">
                      <svg viewBox="0 0 12 12" className="h-3 w-3 text-primary" fill="none" aria-hidden>
                        <path
                          d="M2.5 6.5 5 9l4.5-5.5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
