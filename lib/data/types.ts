/**
 * Domain types for the customer portal. These are deliberately decoupled from
 * the underlying ERP/proprietary system so the data layer can be swapped from
 * mock implementations to real API calls (Acumatica, internal services) by
 * changing only the loaders in `lib/data/*` — pages and components stay the same.
 */

export type DateRange = {
  from: Date;
  to: Date;
  label: string; // e.g. "Year to date", "Custom"
};

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

export type CustomerProfile = {
  id: string;
  name: string;
  primaryContact: string;
  accountSince: number; // year
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
