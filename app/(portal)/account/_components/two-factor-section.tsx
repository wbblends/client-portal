"use client";

import { useActionState, useState, useTransition } from "react";
import { ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmTwoFactorEnrollmentAction,
  disableMyTwoFactorAction,
  startTwoFactorEnrollmentAction,
  type ConfirmEnrollmentResult,
  type DisableSelfResult,
  type StartEnrollmentResult,
} from "../two-factor-actions";
import { FormStatus } from "./form-status";

const CONFIRM_INITIAL: ConfirmEnrollmentResult = { ok: false };
const DISABLE_INITIAL: DisableSelfResult = { ok: false };

type EnrollmentState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "started"; secret: string; secretFormatted: string; otpAuthUrl: string }
  | { kind: "error"; message: string };

export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  if (enabled) return <DisableSection />;
  return <EnrollSection />;
}

function EnrollSection() {
  const [state, setState] = useState<EnrollmentState>({ kind: "idle" });
  const [confirmState, confirmFormAction, confirming] = useActionState(
    confirmTwoFactorEnrollmentAction,
    CONFIRM_INITIAL,
  );
  const [isPending, startTransition] = useTransition();

  function startEnrollment() {
    setState({ kind: "starting" });
    startTransition(async () => {
      const result: StartEnrollmentResult = await startTwoFactorEnrollmentAction();
      if (result.ok) {
        setState({
          kind: "started",
          secret: result.secret,
          secretFormatted: result.secretFormatted,
          otpAuthUrl: result.otpAuthUrl,
        });
      } else {
        setState({ kind: "error", message: result.message });
      }
    });
  }

  if (confirmState.ok && confirmState.recoveryCodes) {
    return <RecoveryCodesPanel codes={confirmState.recoveryCodes} />;
  }

  if (state.kind === "idle" || state.kind === "starting" || state.kind === "error") {
    return (
      <div className="space-y-3">
        <Button onClick={startEnrollment} disabled={isPending} className="w-full">
          <ShieldCheck className="h-4 w-4" />
          {isPending ? "Setting up…" : "Set up two-factor authentication"}
        </Button>
        {state.kind === "error" && (
          <FormStatus ok={false} message={state.message} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-sm">
          <div className="font-medium text-foreground">1. Add to your authenticator app</div>
          <div className="text-xs text-muted mt-0.5">
            On your phone: tap the link below (it opens your authenticator), or paste the secret
            manually. Use any TOTP-compatible app — Authy, 1Password, Google Authenticator, etc.
          </div>
        </div>

        <a
          href={state.otpAuthUrl}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-accent/40 px-3 py-2 text-sm font-medium text-foreground-soft hover:border-border-strong hover:bg-accent transition-colors break-all"
        >
          Open in authenticator app
        </a>

        <div className="space-y-1.5">
          <Label className="text-xs">Or enter this secret manually</Label>
          <SecretField value={state.secretFormatted} />
        </div>
      </div>

      <form action={confirmFormAction} className="space-y-3 border-t border-border pt-4">
        <div className="space-y-1.5">
          <Label htmlFor="confirm-totp">2. Enter the 6-digit code from your app</Label>
          <Input
            id="confirm-totp"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="123456"
            className="font-mono tracking-widest text-center text-lg"
          />
        </div>

        <FormStatus ok={confirmState.ok} message={confirmState.message} />

        <Button type="submit" disabled={confirming} className="w-full">
          {confirming ? "Verifying…" : "Confirm and enable"}
        </Button>
      </form>
    </div>
  );
}

function RecoveryCodesPanel({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-success/20 bg-success-soft px-3 py-2 text-sm text-success font-medium">
        Two-factor authentication is enabled.
      </div>
      <div className="text-sm">
        <div className="font-medium text-foreground">Save your recovery codes</div>
        <div className="text-xs text-muted mt-0.5">
          Each code works once if you lose access to your authenticator. Store them somewhere
          safe — they won&apos;t be shown again.
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm select-all">
        {codes.map(c => (
          <div key={c}>{c}</div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copy} className="w-full">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy all codes"}
      </Button>
    </div>
  );
}

function DisableSection() {
  const [state, formAction, pending] = useActionState(disableMyTwoFactorAction, DISABLE_INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-md border border-info/20 bg-info-soft px-3 py-2 text-sm text-info">
        Two-factor authentication is on for your account.
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="disable-pw">Confirm your password</Label>
        <Input id="disable-pw" name="password" type="password" autoComplete="current-password" required />
      </div>

      <FormStatus ok={state.ok} message={state.message} />

      <Button type="submit" variant="outline" disabled={pending} className="w-full">
        <ShieldOff className="h-4 w-4" />
        {pending ? "Disabling…" : "Disable two-factor"}
      </Button>
    </form>
  );
}

function SecretField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 font-mono text-sm bg-card border border-border rounded-md px-2 py-1.5 select-all tracking-wider">
        {value}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
