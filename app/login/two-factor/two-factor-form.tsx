"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TwoFactorForm({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, mode, next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not verify the code.");
        setLoading(false);
        return;
      }
      router.push(data.next ?? next);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="totp-code">{mode === "totp" ? "6-digit code" : "Recovery code"}</Label>
        <Input
          id="totp-code"
          autoFocus
          inputMode={mode === "totp" ? "numeric" : "text"}
          autoComplete="one-time-code"
          value={code}
          onChange={e => setCode(e.target.value)}
          required
          placeholder={mode === "totp" ? "123456" : "ABCDE-FGHIJ"}
          className="font-mono tracking-widest text-center text-lg"
        />
      </div>

      {error && (
        <div className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Verifying…" : "Verify"}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode(m => (m === "totp" ? "recovery" : "totp"));
          setCode("");
          setError(null);
        }}
        className="block w-full text-center text-xs text-muted hover:text-foreground transition-colors"
      >
        {mode === "totp" ? "Use a recovery code instead" : "Use authenticator app instead"}
      </button>
    </form>
  );
}
