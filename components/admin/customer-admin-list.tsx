"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Pencil, Globe } from "lucide-react";
import type { StoredCustomer, StoredUser } from "@/lib/data/store";
import { EditCustomerModal } from "@/components/admin/edit-customer-modal";

export function CustomerAdminList({
  customers,
  users,
}: {
  customers: StoredCustomer[];
  users: StoredUser[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = customers.find(c => c.id === editingId) ?? null;
  const editingUsers = editing ? users.filter(u => u.customerId === editing.id) : [];

  function close() {
    setEditingId(null);
  }

  function onSaved() {
    // Server is the source of truth — re-fetch.
    router.refresh();
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {customers.map(c => (
          <li key={c.id} className="flex items-center gap-4 py-3">
            <CustomerAvatar customer={c} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                <button
                  type="button"
                  onClick={() => setEditingId(c.id)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-accent hover:text-foreground transition-colors"
                  aria-label={`Edit ${c.name}`}
                  title="Edit customer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>{c.id}</span>
                {c.primaryContact && <span>· {c.primaryContact}</span>}
                {c.email && <span>· {c.email}</span>}
                {c.websiteUrl && (
                  <a
                    href={c.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Globe className="h-3 w-3" />
                    {c.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>
            <div className="hidden sm:block text-right text-xs text-muted">
              {users.filter(u => u.customerId === c.id).length} user
              {users.filter(u => u.customerId === c.id).length === 1 ? "" : "s"}
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <EditCustomerModal
          customer={editing}
          users={editingUsers}
          onClose={close}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

function CustomerAvatar({ customer }: { customer: StoredCustomer }) {
  const initials = customer.name
    .split(" ")
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (customer.avatarUrl) {
    return (
      <Image
        src={customer.avatarUrl}
        alt={customer.name}
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold"
    >
      {initials || "?"}
    </div>
  );
}
