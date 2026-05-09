/**
 * Quality tickets — anything customer-facing that the WB QA team is working
 * with the customer to resolve. Future: pull from the proprietary QA tracker.
 *
 * Mock generator deterministically produces a different mix per customerId so
 * an admin switching customers sees distinct data, but the same customer
 * always sees the same tickets across reloads.
 */
import { hashString, seededRng } from "@/lib/utils";
import type { QualityStatus, QualityTicket } from "./types";

export type { QualityStatus, QualityTicket };

export async function getQualityTickets(customerId: string): Promise<QualityTicket[]> {
  const rng = seededRng(hashString(customerId) ^ 0x71_a1_1c);
  const tickets: QualityTicket[] = [];

  // 2–5 tickets per customer, mostly closed with a couple recent open ones.
  const count = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < count; i++) {
    const template = TEMPLATES[Math.floor(rng() * TEMPLATES.length)];
    const isRecent = i < 2;
    const status: QualityStatus = isRecent
      ? rng() < 0.6
        ? "open"
        : "in_review"
      : "closed";

    const opened = monthsAgo(isRecent ? 1 + rng() * 1.5 : 3 + rng() * 9);
    const updated = monthsAgo(isRecent ? rng() * 0.5 : 2.5 + rng() * 8);

    tickets.push({
      id: `qa-${customerId}-${i}`,
      ticketNumber: `QA-2026-${String(100 + Math.floor(rng() * 900)).padStart(4, "0")}`,
      name: template.name,
      description: template.description,
      status,
      decision: status === "closed" ? template.decision : undefined,
      affectedLot: `Lot ${Math.floor(1000 + rng() * 9000)}`,
      openedDate: fmt(opened),
      lastUpdated: fmt(updated),
      owner: OWNERS[Math.floor(rng() * OWNERS.length)],
    });
  }
  return tickets;
}

const OWNERS = [
  "Marco Liu (WB Quality)",
  "Sara Patel (WB Quality)",
  "Diane Cho (WB Quality)",
];

const TEMPLATES = [
  {
    name: "Dusty Capsules",
    description:
      "Customer reported visible powder accumulation on capsule exterior. WB pulled retains and is investigating fill room conditions.",
    decision: "Documented variance; full lot accepted after second-look QC.",
  },
  {
    name: "Under-Filled Capsules",
    description:
      "Spot-check showed 3–5% defect rate on under-filled capsules. WB and customer both confirmed.",
    decision: "$5,000 credit issued. Lot accepted with documented variance.",
  },
  {
    name: "Off-Color Powder",
    description:
      "Powder shade trending lighter than reference standard. Botanical lot variation suspected.",
    decision: "Lot accepted. Reference standard updated to widen acceptable range.",
  },
  {
    name: "COA Mismatch",
    description:
      "Customer's incoming inspection found heavy-metal value off WB's COA by 0.2 ppm. Re-tested at Eurofins.",
    decision: "Eurofins confirmed within spec. WB's COA reissued with revised value.",
  },
  {
    name: "Pallet Damage in Transit",
    description:
      "Carrier delivered with 2 of 16 pallets crushed. Photos submitted. Filing carrier claim.",
    decision: "Carrier accepted claim. WB shipped replacement pallets next day.",
  },
  {
    name: "Foreign Material",
    description:
      "Customer found one stray fiber in a finished bottle. WB ran metal detector and X-ray retains — no further finds.",
    decision: "Isolated incident. Process change: added secondary sieve before fill.",
  },
];

function monthsAgo(m: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.round(m * 30));
  return d;
}

function fmt(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

export const QUALITY_STATUS_META: Record<
  QualityStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  open: { label: "Open", tone: "warning" },
  in_review: { label: "In Review", tone: "info" },
  closed: { label: "Closed", tone: "success" },
};
