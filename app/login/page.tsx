import Image from "next/image";
import { redirect } from "next/navigation";
import { getLastUserFirstName, getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { LoginGreeting } from "./login-greeting";
import { Logo } from "@/components/ui/logo";

export const metadata = {
  title: "Sign In — WB Blends",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const session = await getSession();
  const params = await props.searchParams;
  const next = typeof params.next === "string" ? params.next : "/dashboard";
  if (session) redirect(next);

  const lastUserFirstName = await getLastUserFirstName();

  return (
    <main className="relative min-h-dvh overflow-hidden bg-surface">
      {/* Full-bleed brand swirl — same swoosh art used on the marketing site,
          unmasked on desktop so it reads as the original asset. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <Image
          src="/brand/swirl.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      <div className="relative grid min-h-dvh grid-rows-1 grid-cols-1 lg:grid-cols-[minmax(440px,520px)_1fr]">
        {/* Form column — sits on a soft surface so the form is readable
            against the swirl behind it. Stronger overlay on mobile so the
            headline + logo aren't fighting the swoosh. */}
        <div className="relative grid place-items-center px-6 py-10 bg-surface/85 backdrop-blur-[3px] lg:bg-surface/95">
          <div className="w-full max-w-[400px]">
            <div className="mb-10">
              <Logo size="lg" />
            </div>

            {lastUserFirstName && (
              <div className="mb-3">
                <LoginGreeting firstName={lastUserFirstName} />
              </div>
            )}

            <h1 className="font-display text-[44px] leading-[1.05] tracking-tight text-foreground">
              Excellence in Every <em className="text-primary">Blend</em>.
            </h1>
            <p className="mt-4 text-[15px] text-muted leading-relaxed">
              Sign in to your portal — promise dates, current production stage,
              and any flags on every open order, anytime.
            </p>

            <div className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card-hover)]">
              <LoginForm next={next} />
            </div>

            <div className="mt-6 text-xs text-muted-soft">
              Don&apos;t have access yet? Reach out to your account manager and we&apos;ll get
              you set up.
            </div>
          </div>
        </div>

        {/* Right column — the swirl shows through. Empty on purpose. */}
        <div className="hidden lg:block" />
      </div>
    </main>
  );
}
