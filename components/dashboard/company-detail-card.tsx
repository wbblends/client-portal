import { Badge } from "@/components/ui/badge";
import type { Company } from "@/lib/data/types";
import { COMPANY_SEGMENT_LABEL, COMPANY_STATUS_META } from "@/lib/data/companies";
import { formatCurrency } from "@/lib/utils";

/**
 * Detail panel rendered inside a Popover when a company name is clicked
 * (currently the customer name in the dashboard header). Shows the kind of
 * org-level facts a sales/AM rep would want at a glance: contacts, addresses,
 * external system pointers, terms.
 */
export function CompanyDetailCard({ company }: { company: Company }) {
  const status = company.status ? COMPANY_STATUS_META[company.status] : null;
  const segment = company.segment ? COMPANY_SEGMENT_LABEL[company.segment] : null;

  return (
    <div className="flex flex-col max-h-[560px]">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span className="font-mono">Customer #{company.id}</span>
              {segment && (
                <>
                  <span>·</span>
                  <span>{segment}</span>
                </>
              )}
            </div>
            <h3 className="mt-1 font-display text-[20px] leading-tight text-foreground truncate">
              {company.name}
            </h3>
          </div>
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
        </div>
      </div>

      <div className="overflow-y-auto px-5 py-4 space-y-4">
        {/* Key facts */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px]">
          <Field label="Account since" value={String(company.accountSince)} mono />
          {company.creditTerms && <Field label="Terms" value={company.creditTerms} />}
          {company.accountManager && (
            <Field label="Account manager" value={company.accountManager} />
          )}
          {company.salesRep && <Field label="Sales rep" value={company.salesRep} />}
          {company.lifetimeValue !== undefined && (
            <Field
              label="Lifetime value"
              value={formatCurrency(company.lifetimeValue, { compact: true })}
              mono
            />
          )}
          <Field label="Primary contact" value={company.primaryContact} />
        </dl>

        {/* Contact info */}
        {(company.primaryEmail || company.primaryPhone || company.websiteUrl) && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1.5">
              Contact
            </div>
            <ul className="space-y-1 text-[12.5px]">
              {company.primaryEmail && (
                <li>
                  <a className="text-primary hover:underline" href={`mailto:${company.primaryEmail}`}>
                    {company.primaryEmail}
                  </a>
                </li>
              )}
              {company.primaryPhone && (
                <li className="text-foreground-soft tabular-nums">{company.primaryPhone}</li>
              )}
              {company.websiteUrl && (
                <li>
                  <a
                    className="text-primary hover:underline"
                    href={company.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {company.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Brands */}
        {company.brands && company.brands.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1.5">
              Brands
            </div>
            <div className="flex flex-wrap gap-1.5">
              {company.brands.map(b => (
                <Badge key={b} tone="neutral">{b}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Addresses */}
        {company.addresses && company.addresses.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1.5">
              Addresses
            </div>
            <ul className="space-y-2 text-[12.5px]">
              {company.addresses.map((a, i) => (
                <li key={i}>
                  <div className="text-[10.5px] uppercase tracking-wide text-muted-soft">
                    {a.label}
                  </div>
                  <div className="text-foreground-soft leading-snug mt-0.5">
                    {a.line1}
                    {a.line2 && <>, {a.line2}</>}
                    <br />
                    {a.city}, {a.region} {a.postalCode} · {a.country}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        {company.notes && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1">
              Notes
            </div>
            <p className="text-[12.5px] text-foreground-soft leading-snug">{company.notes}</p>
          </div>
        )}
      </div>

      {/* Footer with external system IDs */}
      {(company.externalIds?.acumaticaId || company.externalIds?.proprietarySystemId) && (
        <div className="px-5 py-2.5 border-t border-border bg-accent/40 grid grid-cols-2 gap-2 text-[11.5px]">
          {company.externalIds.acumaticaId && (
            <div className="truncate">
              <span className="text-muted">ERP:</span>{" "}
              <span className="font-mono text-muted-soft">{company.externalIds.acumaticaId}</span>
            </div>
          )}
          {company.externalIds.proprietarySystemId && (
            <div className="truncate text-right">
              <span className="text-muted">CRM:</span>{" "}
              <span className="font-mono text-muted-soft">
                {company.externalIds.proprietarySystemId}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">{label}</dt>
      <dd
        className={
          "text-foreground-soft mt-0.5 " + (mono ? "font-mono tabular-nums text-[12px]" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}
