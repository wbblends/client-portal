"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Step = "password" | "mfa";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember, next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not sign in.");
        setLoading(false);
        return;
      }
      if (data.mfaRequired) {
        setStep("mfa");
        setLoading(false);
        return;
      }
      router.push(data.next ?? "/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  async function onCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That code didn't match.");
        setLoading(false);
        return;
      }
      router.push(next || "/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  if (step === "mfa") {
    return (
      <form className="space-y-4" onSubmit={onCodeSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="code">Authenticator code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="123456"
            required
          />
          <p className="text-[11px] text-muted">
            Enter the 6-digit code from your authenticator app, or one of your recovery codes.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Verifying…" : "Verify and sign in"}
        </Button>

        <button
          type="button"
          className="block w-full text-center text-xs text-muted hover:text-foreground"
          onClick={() => {
            setStep("password");
            setCode("");
            setError(null);
          }}
        >
          ← Back to sign-in
        </button>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onPasswordSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/auth/forgot"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
      </div>

      <label className="flex items-center gap-2 select-none">
        <Checkbox checked={remember} onChange={e => setRemember(e.target.checked)} />
        <span className="text-sm text-foreground-soft">Keep me signed in</span>
      </label>

      {error && (
        <div className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>

      <div className="rounded-md border border-dashed border-border bg-accent/40 px-3 py-2 text-xs text-muted">
        <span className="font-medium text-foreground-soft">Demo credentials:</span> dsimmons / test
      </div>
    </form>
  );
}
