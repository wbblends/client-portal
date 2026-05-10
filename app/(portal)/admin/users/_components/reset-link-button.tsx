"use client";

import { useActionState, useState } from "react";
import { Mail, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createResetLinkAction, type ActionResult } from "../actions";
import { FormStatus } from "./form-status";

const INITIAL: ActionResult = { ok: false };

export function ResetLinkButton({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const action = createResetLinkAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [copied, setCopied] = useState(false);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="text-sm">
        <div className="font-medium text-foreground">Send a reset link instead</div>
        <div className="text-xs text-muted">
          A signed, single-use URL valid for 24 hours. Sent to{" "}
          <span className="font-medium text-foreground-soft">{userEmail}</span> when an email
          provider is configured.
        </div>
      </div>

      {state.resetUrl && (
        <div className="rounded-md border border-info/20 bg-info-soft px-3 py-2.5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-info">
            Reset link — copy and share securely
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-card border border-border rounded-md px-2 py-1.5 select-all break-all">
              {state.resetUrl}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copy(state.resetUrl!)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {state.resetExpiresAt && (
            <div className="text-xs text-muted">
              Expires {new Date(state.resetExpiresAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      <FormStatus ok={state.ok} message={state.message} />

      <Button type="submit" variant="outline" disabled={pending} className="w-full">
        <Mail className="h-4 w-4" />
        {pending ? "Creating link…" : "Create reset link"}
      </Button>
    </form>
  );
}
