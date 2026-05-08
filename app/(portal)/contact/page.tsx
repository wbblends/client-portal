import { Mail, Phone, ArrowUpRight } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getContacts } from "@/lib/data/contacts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export const metadata = { title: "Contact — WB Blends" };

export default async function ContactPage() {
  const user = await requireSession();
  const { team, resources } = await getContacts(user.customerId);

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-display text-[34px] leading-[1.1] tracking-tight text-foreground">
          Your <em className="not-italic text-primary">Team</em>.
        </h1>
        <p className="mt-1 text-sm text-muted">
          The people you&apos;ll work with day to day. Day-to-day questions go to your account
          manager — bigger swings to whoever fits. We respond in under one business day.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {team.map(c => {
          const initials = c.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
          return (
            <Card key={c.role}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start gap-3">
                  <div
                    aria-hidden
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold"
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {c.role}
                    </div>
                    <div className="mt-0.5 text-base font-semibold text-foreground">{c.name}</div>
                    <div className="text-sm text-muted">{c.title}</div>
                  </div>
                </div>

                {c.notes && (
                  <p className="mt-3 text-sm text-foreground-soft">{c.notes}</p>
                )}

                <div className="mt-4 space-y-1.5">
                  <a
                    href={`mailto:${c.email}`}
                    className="flex items-center gap-2 text-sm text-foreground-soft hover:text-primary transition-colors"
                  >
                    <Mail className="h-4 w-4 text-muted" />
                    <span className="truncate">{c.email}</span>
                  </a>
                  {c.phone && (
                    <a
                      href={`tel:${c.phone.replace(/\s|\(|\)|-/g, "")}`}
                      className="flex items-center gap-2 text-sm text-foreground-soft hover:text-primary transition-colors"
                    >
                      <Phone className="h-4 w-4 text-muted" />
                      <span>{c.phone}</span>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shared Resources</CardTitle>
          <CardDescription>
            For anything that doesn&apos;t map cleanly to a single person — we triage shared
            inboxes within one business day.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y divide-border">
            {resources.map(r => (
              <li key={r.label} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{r.label}</div>
                  {r.description && <div className="text-sm text-muted mt-0.5">{r.description}</div>}
                </div>
                <a
                  href={r.email ? `mailto:${r.email}` : r.href}
                  className="inline-flex items-center gap-1.5 shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground-soft hover:border-border-strong hover:bg-accent transition-colors"
                >
                  {r.email ?? "Open"}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
