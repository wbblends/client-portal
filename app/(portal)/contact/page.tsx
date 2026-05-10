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
        <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground">
          Your <em className="not-italic text-primary">Team</em>.
        </h1>
        <p className="mt-2 text-base text-foreground-soft leading-relaxed max-w-3xl">
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
                <div className="flex items-start gap-4">
                  <div
                    aria-hidden
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-base font-bold"
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-primary">
                      {c.role}
                    </div>
                    <div className="mt-1 text-lg font-bold text-foreground">{c.name}</div>
                    <div className="text-base text-muted">{c.title}</div>
                  </div>
                </div>

                {c.notes && (
                  <p className="mt-4 text-base text-foreground-soft leading-relaxed">{c.notes}</p>
                )}

                <div className="mt-5 space-y-3">
                  <a
                    href={`mailto:${c.email}`}
                    className="flex items-center gap-3 text-base text-foreground-soft underline-offset-4 hover:text-primary hover:underline transition-colors min-h-[44px]"
                  >
                    <Mail className="h-5 w-5 text-muted shrink-0" aria-hidden />
                    <span className="truncate">{c.email}</span>
                  </a>
                  {c.phone && (
                    <a
                      href={`tel:${c.phone.replace(/\s|\(|\)|-/g, "")}`}
                      className="flex items-center gap-3 text-base text-foreground-soft underline-offset-4 hover:text-primary hover:underline transition-colors min-h-[44px]"
                    >
                      <Phone className="h-5 w-5 text-muted shrink-0" aria-hidden />
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
              <li key={r.label} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="text-base font-bold text-foreground">{r.label}</div>
                  {r.description && <div className="text-base text-foreground-soft mt-1">{r.description}</div>}
                </div>
                <a
                  href={r.email ? `mailto:${r.email}` : r.href}
                  className="inline-flex items-center gap-2 shrink-0 rounded-md border-2 border-border-strong px-4 py-2.5 text-base font-semibold text-foreground hover:border-primary hover:bg-accent transition-colors min-h-[48px]"
                >
                  {r.email ?? "Open"}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
