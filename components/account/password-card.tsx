"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    setErrorMsg(null);
    if (next.length < 10) {
      setStatus("error");
      setErrorMsg("New password must be at least 10 characters.");
      return;
    }
    if (next !== confirm) {
      setStatus("error");
      setErrorMsg("New password and confirmation don't match.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus("error");
        setErrorMsg(data?.error ?? "Couldn't update password.");
        return;
      }
      setStatus("saved");
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="pw-current">Current password</Label>
        <Input
          id="pw-current"
          type="password"
          value={current}
          onChange={e => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-new">New password</Label>
        <Input
          id="pw-new"
          type="password"
          value={next}
          onChange={e => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="text-[11px] text-muted">At least 10 characters.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-confirm">Confirm new password</Label>
        <Input
          id="pw-confirm"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={pending || !current || !next || !confirm}>
          {pending ? "Updating…" : "Update password"}
        </Button>
        {status === "saved" ? (
          <span className="text-xs text-success">Password updated.</span>
        ) : null}
        {status === "error" && errorMsg ? (
          <span className="text-xs text-danger">{errorMsg}</span>
        ) : null}
      </div>
    </form>
  );
}
