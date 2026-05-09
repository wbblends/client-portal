import Link from "next/link";
import { redirect } from "next/navigation";
import { findValidToken } from "@/lib/auth/tokens";
import { getUser } from "@/lib/users/store";
import { SetPasswordForm } from "./form";

export const metadata = { title: "Set Your Password — WB Blends" };

/** Used by both the initial-invite link AND the password-reset link — the
 *  underlying API route accepts both `kind`s. We just adjust copy slightly
 *  based on which kind was found. */
export default async function SetPasswordPage(props: PageProps<"/auth/set-password">) {
  const params = await props.searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  if (!token) redirect("/login");

  const lookup = (await findValidToken(token, "invite")) ?? (await findValidToken(token, "reset"));
  if (!lookup) {
    return (
      <div>
        <h1 className="font-display text-[28px] leading-tight text-foreground">Link expired</h1>
        <p className="mt-2 text-sm text-muted">
          This invite or password-reset link is no longer valid. Ask your admin to send you a
          new one, or request a fresh password reset below.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/auth/forgot"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Reset password
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Back to sign-in
          </Link>
        </div>
      </div>
    );
  }

  const user = await getUser(lookup.username);
  const isInvite = lookup.kind === "invite";
  const heading = isInvite ? "Welcome — set your password" : "Choose a new password";
  const sub = isInvite
    ? `Hi ${user?.name ?? "there"} — pick a password to finish setting up your account.`
    : `Hi ${user?.name ?? "there"} — pick a new password for your account.`;

  return (
    <div>
      <h1 className="font-display text-[28px] leading-tight text-foreground">{heading}</h1>
      <p className="mt-2 text-sm text-muted">{sub}</p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-7 ring-1 ring-primary/[0.04] shadow-[0_1px_2px_rgba(21,16,43,0.04),0_20px_45px_-22px_rgba(110,91,254,0.22)]">
        <SetPasswordForm token={token} />
      </div>
    </div>
  );
}
