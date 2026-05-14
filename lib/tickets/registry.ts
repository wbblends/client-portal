/**
 * Single source of truth for the PM ticket types.
 *
 * Each entry is both a "Project Management" sidebar sub-item and its own
 * page under `/admin/tickets/<slug>`. The per-type page filters the synced
 * ticket rows down to the matching `tab`.
 *
 * To add a ticket type: add an entry below with a unique `slug` and a `tab`
 * that matches the sheet/tab name the 7 AM coworker sync POSTs to
 * `/api/tickets/sync`. It appears in the sidebar and gets its own page
 * automatically.
 *
 * This file is intentionally free of server-only imports so the client
 * sidebar can import it directly — keep it pure data.
 */
export type TicketTypeIconName =
  | "FileText"
  | "RefreshCw"
  | "FlaskConical"
  | "ClipboardCheck"
  | "FileSearch"
  | "FileCheck"
  | "Tag"
  | "BadgeCheck";

export type TicketType = {
  /** URL slug under `/admin/tickets/`. */
  slug: string;
  /** The `tab` value as it arrives from the coworker sync — rows are
   *  matched against this exact string. */
  tab: string;
  /** Sidebar + page-header label. */
  label: string;
  /** Lucide icon name, resolved client-side in the sidebar. */
  iconName: TicketTypeIconName;
};

export const TICKET_TYPES: readonly TicketType[] = [
  { slug: "quote", tab: "Quote", label: "Quote", iconName: "FileText" },
  { slug: "requote", tab: "Requote", label: "Requote", iconName: "RefreshCw" },
  { slug: "rd", tab: "R&D", label: "R&D", iconName: "FlaskConical" },
  { slug: "fps", tab: "FPS", label: "FPS", iconName: "ClipboardCheck" },
  {
    slug: "document-request",
    tab: "Document Request",
    label: "Document Request",
    iconName: "FileSearch",
  },
  { slug: "sfp", tab: "SFP", label: "SFP", iconName: "FileCheck" },
  {
    slug: "label-review",
    tab: "Label Review",
    label: "Label Review",
    iconName: "Tag",
  },
  {
    slug: "certification",
    tab: "Certification",
    label: "Certification",
    iconName: "BadgeCheck",
  },
] as const;

export function listTicketTypes(): readonly TicketType[] {
  return TICKET_TYPES;
}

export function getTicketType(slug: string): TicketType | null {
  return TICKET_TYPES.find(t => t.slug === slug) ?? null;
}
