"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Stage =
  | { kind: "idle" }
  | { kind: "scan"; qr: string; secret: string }
  | { kind: "verifying"; qr: string; secret: string }
  | { kind: "done"; recoveryCodes: string[] }
  | { kind: "disabling" };

/**
 * Two-modes-in-one panel:
 *   - Off → "Set up" button starts enrollment, then QR + code prompt → success +
 *           one-time recovery codes → "I saved them" returns to enabled state.
 *   - On  → "Disable" form (requires password) for self-service teardown.
 */
export function MfaPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function startSetup() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start setup.");
        return;
      }
      setStage({ kind: "scan", qr: data.qrDataUrl, secret: data.secret });
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (stage.kind !== "scan") return;
    setBusy(true);
    try {
      const res = await fetch("/api/account/mfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Code didn't match.");
        return;
      }
      setStage({ kind: "done", recoveryCodes: data.recoveryCodes });
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not disable 2FA.");
        return;
      }
      setStage({ kind: "idle" });
      setPassword("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ─── Done: show one-time recovery codes ────────────────────────────────
  if (stage.kind === "done") {
    const codes = stage.recoveryCodes;
    return (
      <div className="space-y-5">
        <div className="rounded-md border border-success/20 bg-success-soft px-4 py-3 text-sm text-success">
          Two-factor authentication is now on. Save these recovery codes somewhere safe — each
          one can be used once if you lose your authenticator.
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Recovery codes</Label>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
              onClick={async () => {
                await navigator.clipboard.writeText(codes.join("\n"));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy all"}
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-4 font-mono text-sm">
            {codes.map(c => (
              <li key={c} className="text-foreground tracking-wide">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <Button onClick={() => router.refresh()}>I&apos;ve saved them</Button>
      </div>
    );
  }

  // ─── Scan QR → verify ──────────────────────────────────────────────────
  if (stage.kind === "scan" || stage.kind === "verifying") {
    return (
      <div className="space-y-5">
        <ol className="list-decimal pl-4 text-sm space-y-1.5 text-foreground-soft">
          <li>Open your authenticator app (1Password, Authy, Google Authenticator, etc.).</li>
          <li>Add a new account by scanning the QR code below, or enter the secret manually.</li>
          <li>Enter the 6-digit code your app generates.</li>
        </ol>

        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-5 items-start">
          <div className="rounded-lg border border-border bg-white p-2 inline-block">
            <Image
              src={stage.qr}
              alt="MFA QR code"
              width={196}
              height={196}
              unoptimized
            />
          </div>
          <div className="space-y-3">
            <div>
              <Label>Secret (manual entry)</Label>
              <code className="mt-1 block rounded-md border border-border bg-accent/30 px-3 py-2 text-xs font-mono break-all">
                {stage.secret}
              </code>
            </div>
            <form className="space-y-2.5" onSubmit={verifyCode}>
              <div>
                <Label htmlFor="otp">6-digit code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="123456"
                  required
                />
              </div>
              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
                >
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "Verifying…" : "Turn on 2FA"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStage({ kind: "idle" });
                    setCode("");
                    setError(null);
                  }}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Currently enabled — disable flow ──────────────────────────────────
  if (enabled) {
    return (
      <form className="space-y-4" onSubmit={disable}>
        <p className="text-sm text-foreground-soft">
          Turn off two-factor authentication. We&apos;ll ask for your password to confirm.
        </p>
        <div className="space-y-1.5 max-w-[320px]">
          <Label htmlFor="password">Current password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {error}
          </div>
        )}
        <Button type="submit" variant="danger" disabled={busy || !password}>
          {busy ? "Turning off…" : "Turn off 2FA"}
        </Button>
      </form>
    );
  }

  // ─── Idle, MFA not yet set up ──────────────────────────────────────────
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground-soft">
        When 2FA is on, you&apos;ll need a 6-digit code from your authenticator app every time
        you sign in.
      </p>
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </div>
      )}
      <Button onClick={startSetup} disabled={busy}>
        {busy ? "Loading…" : "Set up 2FA"}
      </Button>
    </div>
  );
}
