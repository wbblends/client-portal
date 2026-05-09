"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteUserAction } from "../actions";
import { FormStatus } from "./form-status";

export function DangerZone({
  userId,
  username,
  disableDelete,
}: {
  userId: string;
  username: string;
  disableDelete?: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ready = confirmation === username;

  function onDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || disableDelete) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteUserAction(userId);
      } catch (err) {
        // `redirect()` inside the action throws NEXT_REDIRECT; React handles it.
        // Surface anything else.
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          typeof (err as { digest?: unknown }).digest === "string" &&
          ((err as { digest: string }).digest as string).startsWith("NEXT_REDIRECT")
        ) {
          return;
        }
        setError(err instanceof Error ? err.message : "Could not delete user.");
      }
    });
  }

  return (
    <form onSubmit={onDelete} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`confirm-delete-${userId}`}>
          Type <span className="font-mono text-foreground">{username}</span> to confirm
        </Label>
        <Input
          id={`confirm-delete-${userId}`}
          value={confirmation}
          onChange={e => setConfirmation(e.target.value)}
          autoComplete="off"
          disabled={disableDelete}
        />
      </div>
      {disableDelete && (
        <p className="text-xs text-muted">You can&apos;t delete your own account.</p>
      )}
      <FormStatus ok={false} message={error ?? undefined} />
      <Button
        type="submit"
        variant="danger"
        disabled={!ready || disableDelete || isPending}
        className="w-full"
      >
        <Trash2 className="h-4 w-4" />
        {isPending ? "Deleting…" : "Delete user permanently"}
      </Button>
    </form>
  );
}
