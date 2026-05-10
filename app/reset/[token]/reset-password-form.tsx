"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeResetAction, type ResetActionResult } from "./actions";

const INITIAL: ResetActionResult = { ok: false };

export function ResetPasswordForm({ token }: { token: string }) {
  const action = completeResetAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-success/20 bg-success-soft px-3 py-2.5 text-sm text-success">
          Your password has been updated. You can sign in with your new password now.
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover text-sm font-medium transition-colors"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="new-pw">New password</Label>
        <Input
          id="new-pw"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-pw">Confirm password</Label>
        <Input
          id="confirm-pw"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>

      {state.message && (
        <div className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.message}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
