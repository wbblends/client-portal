"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { StoredCustomer, StoredUser } from "@/lib/data/store";
import { AssetUploader } from "@/components/admin/asset-uploader";
import { InvitePanel } from "@/components/admin/invite-panel";

type Props = {
  customer: StoredCustomer;
  users: StoredUser[];
  onClose: () => void;
  onSaved: () => void;
};

export function EditCustomerModal({ customer, users, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: customer.name,
    email: customer.email,
    primaryContact: customer.primaryContact,
    phone: customer.phone,
    websiteUrl: customer.websiteUrl,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save changes.");
        setSaving(false);
        return;
      }
      onSaved();
      setSaving(false);
    } catch {
      setError("Could not reach the server.");
      setSaving(false);
    }
  }

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${customer.name}`}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-[var(--shadow-popover)]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Edit customer
            </h2>
            <p className="mt-0.5 text-xs text-muted">{customer.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <Section title="Branding" description="Avatar appears in lists; full logo on portal headers.">
            <div className="grid gap-4 sm:grid-cols-2">
              <AssetUploader
                customerId={customer.id}
                kind="avatar"
                label="Avatar"
                currentUrl={customer.avatarUrl}
                shape="circle"
                onUploaded={onSaved}
              />
              <AssetUploader
                customerId={customer.id}
                kind="logo"
                label="Full logo"
                currentUrl={customer.logoUrl}
                shape="rect"
                onUploaded={onSaved}
              />
            </div>
          </Section>

          <Section title="Name & contact" description="Visible across the customer's portal.">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Customer name" htmlFor="cust-name">
                  <Input
                    id="cust-name"
                    value={form.name}
                    onChange={e => update("name", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Primary contact" htmlFor="cust-contact">
                  <Input
                    id="cust-contact"
                    value={form.primaryContact}
                    onChange={e => update("primaryContact", e.target.value)}
                  />
                </Field>
                <Field label="Email" htmlFor="cust-email">
                  <Input
                    id="cust-email"
                    type="email"
                    value={form.email}
                    onChange={e => update("email", e.target.value)}
                  />
                </Field>
                <Field label="Phone" htmlFor="cust-phone">
                  <Input
                    id="cust-phone"
                    value={form.phone}
                    onChange={e => update("phone", e.target.value)}
                  />
                </Field>
                <Field label="Website" htmlFor="cust-website" className="sm:col-span-2">
                  <Input
                    id="cust-website"
                    value={form.websiteUrl}
                    onChange={e => update("websiteUrl", e.target.value)}
                    placeholder="example.com"
                  />
                </Field>
              </div>
              {error && (
                <div className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Section>

          <Section
            title="Portal users"
            description="People who can sign in to this customer's portal."
          >
            {users.length === 0 ? (
              <p className="text-sm text-muted">No users yet — invite one below.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {users.map(u => (
                  <li key={u.username} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{u.name}</div>
                      <div className="truncate text-xs text-muted">
                        {u.email} · @{u.username}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted">
                      {roleLabel(u.role)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Invite a user"
            description="Generates a one-time link they use to set their password and sign in."
          >
            <InvitePanel customerId={customer.id} websiteUrl={customer.websiteUrl} onInvited={onSaved} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function roleLabel(role: StoredUser["role"]): string {
  switch (role) {
    case "super_admin":
      return "Super admin";
    case "customer_admin":
      return "Customer admin";
    case "customer_user":
      return "Customer";
  }
}
