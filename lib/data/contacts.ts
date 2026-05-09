/**
 * Account contacts — the WB-side team a customer works with day-to-day.
 *
 * Future: replace with the customer's actual assignments from the proprietary
 * CRM. The shape here matches what we'd expect from that API: per-customer
 * account manager + sales rep assignment, with shared specialist roles
 * (Quality, AP, AR) and a fixed leadership roster on every account.
 */
import { hashString, seededRng } from "@/lib/utils";
import type { ContactCard, ResourceLink } from "./types";

export async function getContacts(customerId: string): Promise<{
  team: ContactCard[];
  resources: ResourceLink[];
}> {
  const am = AM_BY_CUSTOMER[customerId] ?? AM_PLACEHOLDER;
  const rng = seededRng(hashString(customerId) ^ 0x9c_3f_a1);
  const sales = SALES[Math.floor(rng() * SALES.length)];

  return {
    team: [
      {
        role: "Account Manager",
        name: am.name,
        title: am.title,
        email: am.email,
        phone: am.phone,
        avatarUrl: am.avatarUrl,
        notes:
          "Day-to-day point of contact for orders, forecasts, and quoting. Responses in under one business day.",
      },
      {
        role: "Sales",
        name: sales.name,
        title: sales.title,
        email: sales.email,
        phone: sales.phone,
        avatarUrl: sales.avatarUrl,
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
      ...LEADERSHIP,
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

// Real WB Blends Account Managers, keyed for direct lookup. From the
// 11/24/25 splits sheet. Phones omitted until provided.
const ASHLEY_WELCH = {
  name: "Ashley Welch",
  title: "Account Manager",
  email: "awelch@wbblends.com",
  phone: undefined as string | undefined,
  avatarUrl: "/avatars/awelch.jpg",
} as const;

const COURTNEY_WHITING = {
  name: "Courtney Whiting",
  title: "Account Manager",
  email: "cwhiting@wbblends.com",
  phone: undefined as string | undefined,
  avatarUrl: "/avatars/cwhiting.jpg",
} as const;

const AYRTON_AVULA = {
  name: "Ayrton Avula",
  title: "Account Manager",
  email: "aavula@wbblends.com",
  phone: undefined as string | undefined,
  avatarUrl: "/avatars/aavula.jpg",
} as const;

// Customers without an AM in the splits sheet fall through to this neutral
// placeholder. Every customer in the registry currently has an assigned AM,
// so this only fires if a new customer is added before the splits sheet is
// updated.
const AM_PLACEHOLDER = {
  name: "Unassigned",
  title: "Account Manager",
  email: "success@wbblends.com",
  phone: undefined as string | undefined,
  avatarUrl: undefined as string | undefined,
} as const;

const AM_BY_CUSTOMER: Record<string, typeof ASHLEY_WELCH | typeof COURTNEY_WHITING | typeof AYRTON_AVULA> = {
  // Ashley
  bioptimizer: ASHLEY_WELCH,
  thorne: ASHLEY_WELCH,
  snap: ASHLEY_WELCH,
  // Courtney
  "designs-for-health": COURTNEY_WHITING,
  "golden-hippo": COURTNEY_WHITING,
  "native-path": COURTNEY_WHITING,
  "silver-fern": COURTNEY_WHITING,
  "kilo-health": COURTNEY_WHITING,
  "just-ingredients": COURTNEY_WHITING,
  // Ayrton
  "clean-nutraceuticals": AYRTON_AVULA,
  veracity: AYRTON_AVULA,
  "sports-research": AYRTON_AVULA,
};

// Real WB Blends sales reps. Each customer gets one of these as their
// "Sales" contact, deterministically picked by customerId. Jacob is in the
// fixed leadership roster below as VP of Business Development, not here.
const SALES = [
  {
    name: "Todd Boysen",
    title: "Sales Representative",
    email: "tboysen@wbblends.com",
    phone: "+1 (555) 214-9145",
    avatarUrl: "/avatars/tboysen.jpg",
  },
  {
    name: "Casey Boone",
    title: "Sales Representative",
    email: "cboone@wbblends.com",
    phone: "+1 (555) 214-9151",
    avatarUrl: "/avatars/cboone.jpg",
  },
  {
    name: "Nicole Von Sternberg",
    title: "Sales Representative",
    email: "nicole@wbblends.com",
    phone: "+1 (555) 214-9154",
    avatarUrl: "/avatars/nvonsternberg.jpg",
  },
] as const;

// Shown on every customer contact page in addition to the assigned AM/Sales.
const LEADERSHIP: ContactCard[] = [
  {
    role: "Sales Operations",
    name: "Devin Simmons",
    title: "VP of Sales Operations",
    email: "dsimmons@wbblends.com",
    avatarUrl: "/avatars/dsimmons.jpg",
  },
  {
    role: "Business Development",
    name: "Jacob Fishback",
    title: "VP of Business Development",
    email: "jfishback@wbblends.com",
    avatarUrl: "/avatars/jfishback.jpg",
  },
  {
    role: "Sales Operations",
    name: "Maddie McGeary",
    title: "Director of Sales Operations",
    email: "mmcgeary@wbblends.com",
    avatarUrl: "/avatars/mmcgeary.jpg",
  },
  {
    role: "Customer Success",
    name: "Sydnee Knighton",
    title: "Director of Customer Success",
    email: "sknighton@wbblends.com",
    avatarUrl: "/avatars/sknighton.jpg",
  },
];

