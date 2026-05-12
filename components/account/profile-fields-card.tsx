"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileFieldsCard({
  initialName,
  username,
  email,
}: {
  initialName: string;
  username: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = name.trim() !== initialName.trim();

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    setErrorMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus("error");
        setErrorMsg(data?.error ?? "Couldn't save your changes.");
        return;
      }
      setStatus("saved");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={onSave}>
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Full name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={80}
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-username">Username</Label>
        <Input id="profile-username" value={username} disabled readOnly />
        <p className="text-[11px] text-muted">
          Your username is permanent. Reach out to an admin if you need it changed.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={email} disabled readOnly />
        <p className="text-[11px] text-muted">Email is managed by an admin.</p>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {status === "saved" && !dirty ? (
          <span className="text-xs text-success">Saved.</span>
        ) : null}
        {status === "error" && errorMsg ? (
          <span className="text-xs text-danger">{errorMsg}</span>
        ) : null}
      </div>
    </form>
  );
}
