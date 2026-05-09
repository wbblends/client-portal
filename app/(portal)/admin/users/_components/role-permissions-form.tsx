"use client";

import { useActionState, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, type Permission, type Role } from "@/lib/users-shared";
import {
  updateRoleAndPermissionsAction,
  resetPermissionsAction,
  type ActionResult,
} from "../actions";
import { FormStatus } from "./form-status";

const INITIAL: ActionResult = { ok: false };

const ROLE_ORDER: Role[] = ["super_admin", "admin", "user"];

export function RolePermissionsForm({
  userId,
  role,
  permissions,
  allPermissions,
  disableRoleChange,
}: {
  userId: string;
  role: Role;
  permissions: Permission[];
  allPermissions: { id: Permission; label: string; description: string }[];
  disableRoleChange?: boolean;
}) {
  const save = updateRoleAndPermissionsAction.bind(null, userId);
  const reset = resetPermissionsAction.bind(null, userId);
  const [saveState, saveFormAction, saving] = useActionState(save, INITIAL);
  const [resetState, resetFormAction, resetting] = useActionState(reset, INITIAL);

  const [currentRole, setCurrentRole] = useState<Role>(role);
  const isSuperAdmin = currentRole === "super_admin";

  return (
    <div className="space-y-5">
      <form action={saveFormAction} className="space-y-5">
        <div className="space-y-2">
          <Label>Role</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ROLE_ORDER.map(r => (
              <label
                key={r}
                className={
                  "flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors " +
                  (currentRole === r
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:border-border-strong hover:bg-accent")
                }
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  defaultChecked={r === role}
                  onChange={() => setCurrentRole(r)}
                  disabled={disableRoleChange}
                  className="mt-0.5 accent-[var(--color-primary)]"
                />
                <div className="text-sm">
                  <div className="font-medium text-foreground">{ROLE_LABELS[r]}</div>
                  <div className="text-xs text-muted mt-0.5">{ROLE_DESCRIPTIONS[r]}</div>
                </div>
              </label>
            ))}
          </div>
          {disableRoleChange && (
            <p className="text-xs text-muted">
              You can&apos;t change your own role. Promote another super admin first.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Permissions</Label>
          {isSuperAdmin ? (
            <div className="rounded-md border border-border bg-accent/40 px-3 py-2 text-sm text-foreground-soft">
              Super admins always have full access — individual permissions are ignored.
            </div>
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {allPermissions.map(p => {
                const checked = permissions.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/40"
                  >
                    <Checkbox
                      name="permissions"
                      value={p.id}
                      defaultChecked={checked}
                      className="mt-0.5"
                    />
                    <div className="text-sm">
                      <div className="font-medium text-foreground">{p.label}</div>
                      <div className="text-xs text-muted">{p.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <FormStatus ok={saveState.ok} message={saveState.message} />

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save role & permissions"}
          </Button>
        </div>
      </form>

      <form action={resetFormAction} className="border-t border-border pt-4 flex items-center justify-between gap-4">
        <div className="text-sm">
          <div className="font-medium text-foreground">Reset to default permissions</div>
          <div className="text-xs text-muted">Grants every available portal section.</div>
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={resetting}>
          <RotateCcw className="h-4 w-4" />
          {resetting ? "Resetting…" : "Reset"}
        </Button>
      </form>
      <FormStatus ok={resetState.ok} message={resetState.message} />
    </div>
  );
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Full access. Can manage other users.",
  admin: "Full portal access. Cannot manage users.",
  user: "Access limited to permissions below.",
};
