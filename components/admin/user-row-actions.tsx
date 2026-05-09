"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

type Props = {
  username: string;
  active: boolean;
  hasPassword: boolean;
  mfaEnabled: boolean;
  isSelf: boolean;
};

/**
 * Per-row dropdown menu. Confirms before destructive actions inline with
 * window.confirm — fine for an admin-only screen used by 1-2 people. Switch
 * to a proper modal if multiple admins start using this regularly.
 */
export function UserRowActions({ username, active, hasPassword, mfaEnabled, isSelf }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function call(url: string, init: RequestInit, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Action failed.");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        className="rounded-md p-1 text-muted hover:bg-accent hover:text-foreground"
        onClick={() => setOpen(o => !o)}
        aria-label={`Actions for ${username}`}
        disabled={busy}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-border bg-card shadow-lg overflow-hidden text-sm">
            <Link
              href={`/admin/users/${encodeURIComponent(username)}`}
              className="block px-3 py-2 hover:bg-accent text-foreground"
              onClick={() => setOpen(false)}
            >
              Edit user
            </Link>
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent text-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() =>
                call(
                  `/api/admin/users/${encodeURIComponent(username)}/invite`,
                  { method: "POST" },
                )
              }
            >
              {hasPassword ? "Send password-reset email" : "Resend invite email"}
            </button>
            {mfaEnabled && (
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent text-foreground disabled:opacity-50"
                disabled={busy}
                onClick={() =>
                  call(
                    `/api/admin/users/${encodeURIComponent(username)}/disable-mfa`,
                    { method: "POST" },
                    `Disable 2FA for ${username}? They'll be able to sign in with just their password until they re-enroll.`,
                  )
                }
              >
                Disable 2FA
              </button>
            )}
            {!isSelf && (
              <>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-accent text-foreground disabled:opacity-50"
                  disabled={busy}
                  onClick={() =>
                    call(
                      `/api/admin/users/${encodeURIComponent(username)}`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ active: !active }),
                      },
                    )
                  }
                >
                  {active ? "Deactivate" : "Reactivate"}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-danger-soft text-danger disabled:opacity-50"
                  disabled={busy}
                  onClick={() =>
                    call(
                      `/api/admin/users/${encodeURIComponent(username)}`,
                      { method: "DELETE" },
                      `Permanently delete ${username}? This can't be undone.`,
                    )
                  }
                >
                  Delete user
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
