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
      const target = data.next ?? "/dashboard";
      router.push(target);
      // The 2FA challenge page reads the cookie set by /api/auth/login;
      // refresh isn't needed there since it already runs server-side on load.
      if (!data.twoFactorRequired) router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
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
          <span
            className="text-xs text-muted"
            title="Ask your administrator to send you a reset link"
          >
            Forgot? Ask your admin.
          </span>
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
        <span className="text-sm text-foreground-soft">Keep Me Signed In</span>
      </label>

      {error && (
        <div className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Signing In…" : "Sign In"}
      </Button>

      <div className="rounded-md border border-dashed border-border bg-accent/40 px-3 py-2 text-xs text-muted">
        <span className="font-medium text-foreground-soft">Demo credentials:</span> dsimmons / test
      </div>
    </form>
  );
}
