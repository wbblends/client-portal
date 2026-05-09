"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, type Permission, type Role } from "@/lib/users-shared";
import { createUserAction, type ActionResult } from "../actions";
import { FormStatus } from "./form-status";

const INITIAL: ActionResult = { ok: false };
const ROLE_ORDER: Role[] = ["super_admin", "admin", "user"];

export function NewUserForm({
  allPermissions,
}: {
  allPermissions: { id: Permission; label: string; description: string }[];
}) {
  const [state, formAction, pending] = useActionState(createUserAction, INITIAL);
  const [role, setRole] = useState<Role>("user");
  const [copied, setCopied] = useState(false);

  const isSuperAdmin = role === "super_admin";

  async function copyGenerated(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-name">Full name</Label>
          <Input id="new-name" name="name" required maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-username">Username</Label>
          <Input
            id="new-username"
            name="username"
            required
            pattern="[a-z0-9_]{2,32}"
            title="Lowercase letters, numbers, or underscore. 2–32 characters."
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-email">Email</Label>
        <Input id="new-email" name="email" type="email" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-password">Password</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          placeholder="Leave blank to generate one"
          minLength={6}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted">Min 6 characters. Leave blank for an auto-generated password.</p>
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ROLE_ORDER.map(r => (
            <label
              key={r}
              className={
                "flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors " +
                (role === r
                  ? "border-primary bg-primary-soft"
                  : "border-border hover:border-border-strong hover:bg-accent")
              }
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="mt-0.5 accent-[var(--color-primary)]"
              />
              <div className="text-sm">
                <div className="font-medium text-foreground">{ROLE_LABELS[r]}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Permissions</Label>
        {isSuperAdmin ? (
          <div className="rounded-md border border-border bg-accent/40 px-3 py-2 text-sm text-foreground-soft">
            Super admins always have full access — permissions don&apos;t apply.
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {allPermissions.map(p => (
              <label
                key={p.id}
                className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/40"
              >
                <Checkbox
                  name="permissions"
                  value={p.id}
                  defaultChecked
                  className="mt-0.5"
                />
                <div className="text-sm">
                  <div className="font-medium text-foreground">{p.label}</div>
                  <div className="text-xs text-muted">{p.description}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {state.generatedPassword && (
        <div className="rounded-md border border-info/20 bg-info-soft px-3 py-2.5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-info">
            Temporary password — copy now, won&apos;t be shown again
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

      <div className="flex justify-end gap-2 pt-2">
        <Link
          href="/admin/users"
          className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg border border-border text-foreground-soft hover:bg-accent transition-colors"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
      </div>
    </form>
  );
}
