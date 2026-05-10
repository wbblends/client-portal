"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  customerId: string;
  websiteUrl: string;
  onInvited: () => void;
};

export function InvitePanel({ customerId, websiteUrl, onInvited }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create invite.");
        setSubmitting(false);
        return;
      }
      const url = `${window.location.origin}/accept-invite?token=${encodeURIComponent(
        data.invite.token,
      )}`;
      setLink(url);
      setName("");
      setEmail("");
      onInvited();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Clipboard not available — copy manually.");
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="invite-name">Name</Label>
          <Input
            id="invite-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jane Doe"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={websiteUrl ? `name@${hostFromUrl(websiteUrl)}` : "name@example.com"}
            required
          />
        </div>
        {error && (
          <div className="sm:col-span-2 rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Generating…" : "Generate invite link"}
          </Button>
        </div>
      </form>

      {link && (
        <div className="rounded-lg border border-border bg-accent/40 p-3">
          <div className="text-xs font-medium text-foreground-soft">
            One-time invite link · expires in 7 days
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Input value={link} readOnly className="font-mono text-xs" />
            <Button type="button" variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            The invitee will be granted dashboard, documents, invoices, quality, and contact
            access for this customer.
          </p>
        </div>
      )}
    </div>
  );
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "example.com";
  }
}
