"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyProfileAction, type AccountActionResult } from "../actions";
import { FormStatus } from "./form-status";

const INITIAL: AccountActionResult = { ok: false };

export function MyProfileForm({
  username,
  defaultValues,
}: {
  username: string;
  defaultValues: { name: string; email: string };
}) {
  const [state, formAction, pending] = useActionState(updateMyProfileAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="my-username">Username</Label>
        <Input id="my-username" value={username} disabled readOnly />
        <p className="text-xs text-muted">Contact an administrator to change your username.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="my-name">Full name</Label>
        <Input id="my-name" name="name" defaultValue={defaultValues.name} required maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="my-email">Email</Label>
        <Input
          id="my-email"
          name="email"
          type="email"
          defaultValue={defaultValues.email}
          required
          maxLength={200}
        />
      </div>

      <FormStatus ok={state.ok} message={state.message} />

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
