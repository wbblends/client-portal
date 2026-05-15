"use client";

import { useMemo, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Upload, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TeamAvatar } from "@/components/portal/team-avatar";
import type { CustomerPermission, UserRole } from "@/lib/users/store";

type DashboardOption = { id: string; name: string; category: string };
type CustomerOption = { id: string; name: string };

export type UserFormInitial = {
  username: string;
  email: string;
  name: string;
  company: string;
  role: UserRole;
  customerIds: string[];
  /** Per-customer permission. Missing entries default to 'viewer'. */
  customerPermissions: Record<string, CustomerPermission>;
  dashboards: string[];
  avatarUrl: string | null;
};

/**
 * Shared form for creating or editing a user. In create mode (no `editing`)
 * username is editable and the action POSTs to /api/admin/users; in edit mode
 * username is read-only and we PATCH to /api/admin/users/[username].
 */
export function UserForm({
  dashboards,
  customers,
  initial,
  editing,
}: {
  dashboards: DashboardOption[];
  customers: CustomerOption[];
  initial?: Partial<UserFormInitial>;
  editing?: { username: string };
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initial?.username ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [company, setCompany] = useState(initial?.company ?? "Western Botanicals");
  const [role, setRole] = useState<UserRole>(initial?.role ?? "customer");
  const [pickedDashboards, setPickedDashboards] = useState<Set<string>>(
    new Set(initial?.dashboards ?? []),
  );
  const [pickedCustomers, setPickedCustomers] = useState<Set<string>>(
    new Set(initial?.customerIds ?? []),
  );
  const [customerPermissions, setCustomerPermissions] = useState<
    Record<string, CustomerPermission>
  >(initial?.customerPermissions ?? {});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial?.avatarUrl ?? null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedDashboards = useMemo(() => {
    const map = new Map<string, DashboardOption[]>();
    for (const d of dashboards) {
      if (!map.has(d.category)) map.set(d.category, []);
      map.get(d.category)!.push(d);
    }
    return [...map.entries()];
  }, [dashboards]);

  const valid = username.trim() && name.trim() && email.trim() && company.trim();

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function onAvatarPick(e: ChangeEvent<HTMLInputElement>) {
    setAvatarError(null);
    const file = e.target.files?.[0];
    // Clear the input so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
      setAvatarError("Pick a PNG, JPG, WebP, or GIF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAvatarError("That image is over 8 MB — pick something smaller.");
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256, 0.85);
      if (dataUrl.length > 280_000) {
        setAvatarError("Couldn't compress that image small enough. Try a different one.");
        return;
      }
      setAvatarUrl(dataUrl);
    } catch {
      setAvatarError("Couldn't read that image.");
    }
  }

  function setPermission(customerId: string, permission: CustomerPermission) {
    setCustomerPermissions(prev => ({ ...prev, [customerId]: permission }));
    // Picking a permission for a customer also implies they have access.
    if (!pickedCustomers.has(customerId)) {
      const next = new Set(pickedCustomers);
      next.add(customerId);
      setPickedCustomers(next);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const body = {
      username: username.trim(),
      email: email.trim(),
      name: name.trim(),
      company: company.trim(),
      role,
      customers: [...pickedCustomers].map(id => ({
        id,
        permission: customerPermissions[id] ?? "viewer",
      })),
      dashboards: [...pickedDashboards],
      avatarUrl,
    };
    try {
      const url = editing
        ? `/api/admin/users/${encodeURIComponent(editing.username)}`
        : `/api/admin/users`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        setLoading(false);
        return;
      }
      router.push("/admin/users");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <form className="space-y-7" onSubmit={onSubmit}>
      <div className="flex items-center gap-4">
        <TeamAvatar src={avatarUrl} name={name || username || "?"} size={64} />
        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-medium text-foreground">Profile picture</div>
          <div className="flex items-center gap-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={onAvatarPick}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => avatarInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {avatarUrl ? "Replace" : "Upload"}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAvatarUrl(null);
                  setAvatarError(null);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            )}
          </div>
          {avatarError && (
            <p className="text-[11px] text-danger">{avatarError}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Username" required>
          <Input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="jsmith"
            autoComplete="off"
            disabled={!!editing}
          />
        </Field>
        <Field label="Email" required>
          <Input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            placeholder="jane@example.com"
          />
        </Field>
        <Field label="Full name" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
        </Field>
        <Field label="Company / brand" required>
          <Input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="Acme Co."
          />
        </Field>
      </div>

      <Field
        label="Role"
        hint="Customer: locked to assigned customers. Internal: WB Blends staff who switch customers. Admin: switches customers and manages users. Super Admin: everything Admin does, plus auto-access to every dashboard in the registry (ignores the picks below)."
      >
        <div className="flex gap-2 flex-wrap">
          <RoleChip value="customer" current={role} onClick={() => setRole("customer")}>
            Customer
          </RoleChip>
          <RoleChip value="internal" current={role} onClick={() => setRole("internal")}>
            Internal
          </RoleChip>
          <RoleChip value="admin" current={role} onClick={() => setRole("admin")}>
            Admin
          </RoleChip>
          <RoleChip
            value="super_admin"
            current={role}
            onClick={() => setRole("super_admin")}
          >
            Super Admin
          </RoleChip>
        </div>
      </Field>

      <div>
        <div className="text-sm font-medium text-foreground mb-3">Customers</div>
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {customers.map(c => {
            const checked = pickedCustomers.has(c.id);
            const perm = customerPermissions[c.id] ?? "viewer";
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-2.5"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0">
                  <Checkbox
                    checked={checked}
                    onChange={() => toggle(pickedCustomers, setPickedCustomers, c.id)}
                  />
                  <span className="text-foreground-soft truncate">
                    {c.name}
                    <span className="text-muted-soft text-[11px] ml-1">({c.id})</span>
                  </span>
                </label>
                <PermissionToggle
                  value={perm}
                  disabled={!checked}
                  onChange={p => setPermission(c.id, p)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-foreground mb-3">Dashboards</div>
        <div className="space-y-4 rounded-lg border border-border p-4 bg-card">
          {groupedDashboards.map(([category, items]) => (
            <div key={category}>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-soft mb-1.5">
                {category}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5">
                {items.map(d => (
                  <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={pickedDashboards.has(d.id)}
                      onChange={() => toggle(pickedDashboards, setPickedDashboards, d.id)}
                    />
                    <span className="text-foreground-soft">{d.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 justify-end pt-2 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/users")}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || loading}>
          {loading ? "Saving…" : editing ? "Save changes" : "Create user & send invite"}
        </Button>
      </div>


      {editing && <SetPasswordSection username={editing.username} />}
    </form>
  );
}

/** Lets an admin set a user's password directly, bypassing the invite/reset
 *  email flow. Posts its own PATCH so the surrounding "Save changes" button
 *  doesn't have to know about it. */
function SetPasswordSection({ username }: { username: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const tooShort = password.length > 0 && password.length < 10;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSave = password.length >= 10 && password === confirm && !busy;

  async function save() {
    if (
      !window.confirm(
        `Set a new password for ${username}? They'll be able to sign in with this immediately.`,
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Could not set password." });
      } else {
        setMsg({ kind: "ok", text: "Password updated." });
        setPassword("");
        setConfirm("");
      }
    } catch {
      setMsg({ kind: "err", text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div>
        <div className="text-sm font-medium text-foreground">Set password</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="New password">
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 10 characters"
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm">
          <Input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>
      {tooShort && (
        <p className="text-[11px] text-danger">Password must be at least 10 characters.</p>
      )}
      {mismatch && <p className="text-[11px] text-danger">Passwords don&apos;t match.</p>}
      {msg && (
        <p
          role="alert"
          aria-live="polite"
          className={"text-xs " + (msg.kind === "ok" ? "text-success" : "text-danger")}
        >
          {msg.text}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!canSave} onClick={save}>
          {busy ? "Saving…" : "Set password"}
        </Button>
      </div>
    </div>
  );
}

/** Resize an image file in the browser to a square `size`×`size` JPEG data
 *  URL using a center-crop. Keeps the avatar small and the DB row tiny. */
async function resizeImageToDataUrl(file: File, size: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    const min = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - min) / 2;
    const sy = (img.naturalHeight - min) / 2;
    ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-danger">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function PermissionToggle({
  value,
  onChange,
  disabled,
}: {
  value: CustomerPermission;
  onChange: (next: CustomerPermission) => void;
  disabled: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Permission"
      className={
        "inline-flex shrink-0 rounded-md border border-border bg-card overflow-hidden text-xs " +
        (disabled ? "opacity-50" : "")
      }
    >
      <PermissionButton
        active={value === "viewer"}
        disabled={disabled}
        onClick={() => onChange("viewer")}
      >
        <Eye className="h-3 w-3" /> Viewer
      </PermissionButton>
      <PermissionButton
        active={value === "editor"}
        disabled={disabled}
        onClick={() => onChange("editor")}
      >
        <Pencil className="h-3 w-3" /> Editor
      </PermissionButton>
    </div>
  );
}

function PermissionButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1 px-2.5 py-1 transition-colors " +
        (active
          ? "bg-primary-soft text-primary"
          : "text-foreground-soft hover:bg-accent disabled:hover:bg-transparent")
      }
    >
      {children}
    </button>
  );
}

function RoleChip({
  value,
  current,
  onClick,
  children,
}: {
  value: UserRole;
  current: UserRole;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border bg-card text-foreground-soft hover:bg-accent")
      }
    >
      {children}
    </button>
  );
}
