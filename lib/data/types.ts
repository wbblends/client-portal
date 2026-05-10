/**
 * Domain types for the customer portal. These are deliberately decoupled from
 * the underlying ERP/proprietary system so the data layer can be swapped from
 * mock implementations to real API calls (Acumatica, internal services) by
 * changing only the loaders in `lib/data/*` — pages and components stay the same.
 *
 * Records that flow in from upstream systems carry `externalIds` so a portal
 * row can be reconciled back to its source-of-truth in either system.
 */

export type DateRange = {
  from: Date;
  to: Date;
  label: string; // e.g. "Year to date", "Custom"
};

/**
 * Source-system pointers attached to records that originate outside the portal
 * (Orders & Companies → Acumatica; Onboarding Projects → proprietary
 * commercialization tracker).
 */
export type ExternalIds = {
  acumaticaId?: string;
  proprietarySystemId?: string;
};

export type Address = {
  label: string; // "Headquarters", "Ship-to: Reno DC"
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export type CompanySegment =
  | "small"
  | "midmarket"
  | "enterprise"
  | "distributor"
  | "private_label";

export type CompanyStatus = "active" | "prospect" | "paused" | "former";

export type OrderStatus =
  | "open"
  | "in_production"
  | "shipped"
  | "delivered"
  | "delayed"
  | "canceled";

export type OrderLine = {
  id: string;
  poNumber: string;
  orderDate: Date;
  promisedDate: Date;
  shippedDate: Date | null;
  deliveredDate: Date | null;
  sku: string;
  skuName: string;
  category: string;
  units: number;
  unitPrice: number;
  amount: number;
  status: OrderStatus;
};

export type InvoiceStatus = "paid" | "open" | "overdue" | "partial" | "draft";

export type Invoice = {
  id: string;
  number: string;
  poNumber?: string;
  issueDate: Date;
  dueDate: Date;
  amount: number;
  paidAmount: number;
  status: InvoiceStatus;
};

export type DocNode = {
  id: string;
  parentId: string | null;
  name: string;
  kind: "folder" | "file";
  fileType?: "pdf" | "xlsx" | "docx" | "csv" | "png" | "jpg" | "txt";
  size?: number; // bytes
  modified?: Date;
};

export type ContactCard = {
  role: string; // "Account Manager"
  name: string;
  title: string;
  email: string;
  phone?: string;
  notes?: string;
};

export type ResourceLink = {
  label: string;
  email?: string;
  href?: string;
  description?: string;
};

/**
 * A company is the canonical org-level record we hold for a buyer. One portal
 * user maps to one primary company today via `SessionUser.customerId`, but the
 * directory below is the full set WB Blends does business with — sourced from
 * Acumatica (financial truth) joined with the proprietary CRM (contacts,
 * segment, brand metadata).
 */
export type Company = {
  id: string;
  name: string;
  primaryContact: string;
  accountSince: number; // year
  segment?: CompanySegment;
  status?: CompanyStatus;
  websiteUrl?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  accountManager?: string; // WB-side AM name
  salesRep?: string;
  parentCompanyId?: string | null;
  brands?: string[]; // sub-brands sold under this company
  addresses?: Address[];
  externalIds?: ExternalIds;
  creditTerms?: string; // "Net 30"
  lifetimeValue?: number; // dollars; rolled up from Acumatica
  notes?: string;
};

export type MarketIndicator = {
  id: string;
  label: string;
  value: string;
  delta: number; // % vs prior period
  unit?: string;
  note?: string;
};

export type Pitch = {
  id: string;
  title: string;
  category: string;
  blurb: string;
  highlight: string; // short data point
  cta?: string;
};
