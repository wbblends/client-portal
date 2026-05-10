import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { readTwoFactorChallenge } from "@/lib/auth";
import { getUser } from "@/lib/users";
import { TwoFactorForm } from "./two-factor-form";

export const metadata = { title: "Two-factor — WB Blends" };

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const challenge = await readTwoFactorChallenge();
  const params = await searchParams;
  if (!challenge) redirect("/login");
  const user = getUser(challenge.userId);
  if (!user) redirect("/login");

  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/dashboard";

  return (
    <main className="min-h-dvh grid place-items-center bg-surface px-6 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card-hover)]">
          <h1 className="font-display text-[28px] leading-tight text-foreground">
            Two-factor <em className="not-italic text-primary">code</em>.
          </h1>
          <p className="mt-2 text-sm text-muted">
            Open your authenticator app and enter the 6-digit code for{" "}
            <span className="font-medium text-foreground-soft">@{user.username}</span>. Lost your
            device? Use a recovery code instead.
          </p>
          <div className="mt-6">
            <TwoFactorForm next={next} />
          </div>
        </div>
      </div>
    </main>
  );
}
