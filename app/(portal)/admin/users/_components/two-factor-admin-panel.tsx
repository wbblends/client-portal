"use client";

import { useActionState } from "react";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disableTwoFactorAction, type ActionResult } from "../actions";
import { FormStatus } from "./form-status";

const INITIAL: ActionResult = { ok: false };

export function TwoFactorAdminPanel({
  userId,
  enabled,
}: {
  userId: string;
  enabled: boolean;
}) {
  const action = disableTwoFactorAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  if (!enabled) {
    return (
      <div className="text-sm text-muted">
        The user can enable 2FA themselves from{" "}
        <span className="font-medium text-foreground-soft">/account</span>.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="rounded-md border border-info/20 bg-info-soft px-3 py-2 text-sm text-info">
        2FA is enabled for this user.
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-full">
        <ShieldOff className="h-4 w-4" />
        {pending ? "Disabling…" : "Disable 2FA"}
      </Button>
      <p className="text-xs text-muted">
        Use only when the user has lost access to their authenticator and recovery codes. Their
        sessions will be invalidated.
      </p>
      <FormStatus ok={state.ok} message={state.message} />
    </form>
  );
}
