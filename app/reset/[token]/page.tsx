import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { peekResetToken } from "@/lib/reset-tokens";
import { getUser } from "@/lib/users";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Reset Password — WB Blends" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const peeked = peekResetToken(token);
  const user = peeked ? getUser(peeked.userId) : null;

  return (
    <main className="min-h-dvh grid place-items-center bg-surface px-6 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card-hover)]">
          <h1 className="font-display text-[28px] leading-tight text-foreground">
            Reset your <em className="not-italic text-primary">password</em>.
          </h1>

          {!peeked || !user ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-foreground-soft">
                This reset link is invalid or has expired. Ask an administrator for a new one.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm text-primary hover:underline"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">
                Setting a new password for{" "}
                <span className="font-medium text-foreground-soft">@{user.username}</span>. Pick
                something at least 6 characters long.
              </p>
              <div className="mt-6">
                <ResetPasswordForm token={token} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
