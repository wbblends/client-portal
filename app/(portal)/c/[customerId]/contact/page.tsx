import { Mail, Phone, ArrowUpRight } from "lucide-react";
import { requireCustomerAccess } from "@/lib/auth";
import { getContacts } from "@/lib/data/contacts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TeamAvatar } from "@/components/portal/team-avatar";

export const metadata = { title: "Contact — WB Blends" };

export default async function ContactPage(props: PageProps<"/c/[customerId]/contact">) {
  const { customerId } = await props.params;
  const { customer } = await requireCustomerAccess(customerId);
  const { team, resources } = await getContacts(customer.id);

  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-6">
      <div>
        <p className="text-sm text-muted">{customer.name}</p>
        <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
          Your <span className="text-primary">Team</span>.
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {team.map(c => {
          return (
            <Card key={c.email}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start gap-3">
                  <TeamAvatar src={c.avatarUrl} name={c.name} size={44} />
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
              <li
                key={r.label}
                className="px-4 sm:px-5 py-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{r.label}</div>
                  {r.description && <div className="text-sm text-muted mt-0.5">{r.description}</div>}
                </div>
                <a
                  href={r.email ? `mailto:${r.email}` : r.href}
                  className="inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto max-w-full rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground-soft hover:border-border-strong hover:bg-accent transition-colors"
                >
                  <span className="truncate">{r.email ?? "Open"}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
