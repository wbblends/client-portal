/**
 * Shared user types and static metadata that are safe to import from both
 * server and client components. Anything with a Node-only dependency (e.g.
 * `node:crypto`) lives in `lib/users.ts` instead.
 */

export type Role = "super_admin" | "admin" | "user";

export type Permission =
  | "dashboard:read"
  | "documents:read"
  | "invoices:read"
  | "quality:read"
  | "contact:read";

export type UserStatus = "active" | "disabled";

export type PublicUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  company: string;
  customerId: string;
  avatarUrl?: string;
  role: Role;
  permissions: Permission[];
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  user: "User",
};

export const ALL_PERMISSIONS: { id: Permission; label: string; description: string }[] = [
  {
    id: "dashboard:read",
    label: "Dashboard",
    description: "View account overview, KPIs, and recent activity.",
  },
  {
    id: "documents:read",
    label: "Documents",
    description: "Access shared documents, COAs, and finished-product specs.",
  },
  {
    id: "invoices:read",
    label: "Invoices",
    description: "View invoices, statements, and payment history.",
  },
  {
    id: "quality:read",
    label: "Quality",
    description: "Quality records, deviations, and audit-ready documentation.",
  },
  {
    id: "contact:read",
    label: "Contact",
    description: "Account team directory and shared support inboxes.",
  },
];

export const DEFAULT_PERMISSIONS: Permission[] = [
  "dashboard:read",
  "documents:read",
  "invoices:read",
  "quality:read",
  "contact:read",
];
