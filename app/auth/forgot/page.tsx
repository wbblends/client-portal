import Link from "next/link";
import { ForgotForm } from "./form";

export const metadata = { title: "Forgot Password — WB Blends" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="font-display text-[28px] leading-tight text-foreground">
        Reset your password
      </h1>

      <div className="mt-6 rounded-2xl border border-border bg-card p-7 ring-1 ring-primary/[0.04] shadow-[0_1px_2px_rgba(17,11,41,0.04),0_20px_45px_-22px_rgba(101,64,227,0.22)]">
        <ForgotForm />
      </div>

      <div className="mt-5 text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="text-foreground hover:underline">
          Back to sign-in
        </Link>
      </div>
    </div>
  );
}
