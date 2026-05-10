"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
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
      router.push(data.next ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          aria-required="true"
          aria-invalid={error ? true : undefined}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Label htmlFor="password">Password</Label>
          <a
            href="#"
            className="text-base font-semibold text-primary underline underline-offset-4 hover:text-primary-hover transition-colors"
          >
            Forgot Password?
          </a>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          aria-required="true"
          aria-invalid={error ? true : undefined}
        />
      </div>

      <label className="flex items-center gap-3 select-none cursor-pointer py-1">
        <Checkbox checked={remember} onChange={e => setRemember(e.target.checked)} />
        <span className="text-base font-medium text-foreground">Keep Me Signed In</span>
      </label>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border-2 border-danger/40 bg-danger-soft px-4 py-3 text-base text-danger"
        >
          <span aria-hidden className="mt-0.5 text-xl leading-none">⚠</span>
          <div>
            <div className="font-bold">We couldn&apos;t sign you in</div>
            <div className="font-medium">{error}</div>
          </div>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Signing In…" : "Sign In"}
      </Button>

      <p className="text-center text-base text-foreground-soft">
        Need help signing in? Call us at{" "}
        <a href="tel:+18005551234" className="font-semibold text-primary underline underline-offset-4">
          1‑800‑555‑1234
        </a>
      </p>

      <div className="rounded-lg border-2 border-dashed border-border-strong bg-accent/40 px-4 py-3 text-sm text-muted">
        <span className="font-semibold text-foreground-soft">Demo credentials:</span> dsimmons / test
      </div>
    </form>
  );
}
