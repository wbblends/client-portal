"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction, type ActionResult } from "../actions";
import { FormStatus } from "./form-status";

const INITIAL: ActionResult = { ok: false };

export function ProfileForm({
  userId,
  defaultValues,
}: {
  userId: string;
  defaultValues: { name: string; username: string; email: string };
}) {
  const action = updateProfileAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`name-${userId}`}>Full name</Label>
          <Input id={`name-${userId}`} name="name" defaultValue={defaultValues.name} required maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`username-${userId}`}>Username</Label>
          <Input
            id={`username-${userId}`}
            name="username"
            defaultValue={defaultValues.username}
            required
            pattern="[a-z0-9_]{2,32}"
            title="Lowercase letters, numbers, or underscore. 2–32 characters."
            autoComplete="off"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`email-${userId}`}>Email</Label>
        <Input
          id={`email-${userId}`}
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
