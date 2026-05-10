"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(token ? null : "Missing invite token.");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not accept invite.");
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
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="invite-username">Username</Label>
        <Input
          id="invite-username"
          autoComplete="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          disabled={!token}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-password">Password</Label>
        <Input
          id="invite-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={!token}
        />
      </div>
      {error && (
        <div className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={loading || !token}>
        {loading ? "Setting up…" : "Create account"}
      </Button>
    </form>
  );
}
