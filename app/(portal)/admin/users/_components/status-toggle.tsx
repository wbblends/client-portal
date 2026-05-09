"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { setStatusAction, type ActionResult } from "../actions";
import { FormStatus } from "./form-status";
import type { UserStatus } from "@/lib/users-shared";

const INITIAL: ActionResult = { ok: false };

export function StatusToggle({
  userId,
  status,
  disabledForSelf,
}: {
  userId: string;
  status: UserStatus;
  disabledForSelf?: boolean;
}) {
  const action = setStatusAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  const isActive = status === "active";
  const nextStatus: UserStatus = isActive ? "disabled" : "active";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="status" value={nextStatus} />
      <div className="flex items-center gap-3">
        <span
          className={
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium border " +
            (isActive
              ? "bg-success-soft text-success border-success/15"
              : "bg-warning-soft text-warning border-warning/20")
          }
        >
          {isActive ? "Active" : "Disabled"}
        </span>
      </div>
      <Button
        type="submit"
        variant={isActive ? "outline" : "primary"}
        size="sm"
        disabled={pending || disabledForSelf}
        className="w-full"
      >
        {pending
          ? isActive
            ? "Disabling…"
            : "Reactivating…"
          : isActive
            ? "Disable user"
            : "Reactivate user"}
      </Button>
      {disabledForSelf && (
        <p className="text-xs text-muted">You can&apos;t disable your own account.</p>
      )}
      <FormStatus ok={state.ok} message={state.message} />
    </form>
  );
}
