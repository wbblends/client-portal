"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
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
        <div className="text-sm font-medium text-foreground mb-1">Customers</div>
        <p className="text-xs text-muted mb-3">
          {role === "customer"
            ? "Check every customer this user can see, then pick their permission for the Documents area. Viewers can browse files; editors can also add folders and documents. (Invoices, Quality, and Contact are read-only for everyone.)"
            : "Internal, admin, and super admin users see all customers automatically — these picks are ignored. They are always treated as editors in every customer's Documents area."}
        </p>
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
        <div className="text-sm font-medium text-foreground mb-1">Dashboards</div>
        <p className="text-xs text-muted mb-3">
          {role === "super_admin"
            ? "Super admins see every dashboard automatically — these picks are ignored. Future dashboards added to the registry will appear for them without any change here."
            : "Pick every cross-customer dashboard this user can see. New dashboards added to the registry will appear here automatically."}
        </p>
        <div className="space-y-4 rounded-lg border border-border p-4 bg-card">
          {groupedDashboards.map(([category, items]) => (
            <div key={category}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-soft mb-1.5">
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
        <div className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
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

      {!editing && (
        <p className="text-xs text-muted -mt-3 text-right">
          The user will get an email with a link to set their password.
        </p>
      )}
    </form>
  );
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
