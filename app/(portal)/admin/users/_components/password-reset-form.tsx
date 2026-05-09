"use client";

import { useActionState, useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction, type ActionResult } from "../actions";
import { FormStatus } from "./form-status";

const INITIAL: ActionResult = { ok: false };

export function PasswordResetForm({ userId }: { userId: string }) {
  const action = resetPasswordAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyGenerated(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — older browsers
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`password-${userId}`}>New password</Label>
        <div className="relative">
          <Input
            id={`password-${userId}`}
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Leave blank to generate a temporary one"
            autoComplete="new-password"
            minLength={6}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted hover:bg-accent hover:text-foreground transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted">Min 6 characters. Leave blank for a 14-character generated password.</p>
      </div>

      {state.generatedPassword && (
        <div className="rounded-md border border-info/20 bg-info-soft px-3 py-2.5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-info">
            New password — copy now, won&apos;t be shown again
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm bg-card border border-border rounded-md px-2 py-1.5 select-all">
              {state.generatedPassword}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyGenerated(state.generatedPassword!)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <FormStatus ok={state.ok} message={state.message} />

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Resetting…" : "Reset password"}
        </Button>
      </div>
    </form>
  );
}
