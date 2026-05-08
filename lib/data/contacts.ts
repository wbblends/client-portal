import type { ContactCard, ResourceLink } from "./types";

/**
 * Mock account contacts. Future: per-customer assignment from CRM.
 */
export async function getContacts(_customerId: string): Promise<{
  team: ContactCard[];
  resources: ResourceLink[];
}> {
  return {
    team: [
      {
        role: "Account Manager",
        name: "Jordan Reyes",
        title: "Senior Account Manager",
        email: "jordan.reyes@wbblends.com",
        phone: "+1 (555) 214-9012",
        notes:
          "Day-to-day point of contact for orders, forecasts, and quoting. Responses in under one business day.",
      },
      {
        role: "Sales",
        name: "Priya Patel",
        title: "Director of Sales",
        email: "priya.patel@wbblends.com",
        phone: "+1 (555) 214-9145",
        notes:
          "Pricing, contracts, and new program launches. Quotes returned in 5–6 business days.",
      },
      {
        role: "Quality",
        name: "Marco Liu",
        title: "Quality Assurance Manager",
        email: "quality@wbblends.com",
        phone: "+1 (555) 214-9220",
        notes:
          "COAs, finished product specs, deviations, and audit requests. NSF/ANSI 455-2, FDA, and Eurofins-ready documentation.",
      },
      {
        role: "Accounts Payable",
        name: "Aisha Brown",
        title: "AP Coordinator",
        email: "ap@wbblends.com",
        phone: "+1 (555) 214-9301",
        notes: "Vendor onboarding, W-9s, and remittance.",
      },
      {
        role: "Accounts Receivable",
        name: "Daniel Cho",
        title: "AR Coordinator",
        email: "ar@wbblends.com",
        phone: "+1 (555) 214-9322",
        notes: "Invoice questions, statements, and payment status.",
      },
    ],
    resources: [
      {
        label: "General Inbox",
        email: "info@wbblends.com",
        description: "Anything that doesn't fit elsewhere — we triage within one business day.",
      },
      {
        label: "Customer Success",
        email: "success@wbblends.com",
        description: "Order changes, ETA questions, and weekly Friday status escalations.",
      },
      {
        label: "Compliance & Regulatory",
        email: "compliance@wbblends.com",
        description: "FDA registrations, NSF/ANSI 455-2, organic, kosher, and halal certifications.",
      },
      {
        label: "Main Line",
        href: "tel:+15552149000",
        description: "Mon–Fri, 7am–4pm MT.",
      },
    ],
  };
}
