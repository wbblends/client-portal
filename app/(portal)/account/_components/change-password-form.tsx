"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMyPasswordAction, type AccountActionResult } from "../actions";
import { FormStatus } from "./form-status";

const INITIAL: AccountActionResult = { ok: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeMyPasswordAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cur-pw">Current password</Label>
        <Input id="cur-pw" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-pw">New password</Label>
        <Input
          id="new-pw"
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="conf-pw">Confirm new password</Label>
        <Input
          id="conf-pw"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>

      <FormStatus ok={state.ok} message={state.message} />

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
