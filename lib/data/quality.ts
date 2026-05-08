/**
 * Quality tickets — anything customer-facing that the WB QA team is working
 * with the customer to resolve. Future: pull from the proprietary QA tracker.
 */

export type QualityStatus = "open" | "in_review" | "closed";

export type QualityTicket = {
  id: string;
  ticketNumber: string;
  name: string;
  description: string;
  status: QualityStatus;
  decision?: string;       // closed-only resolution summary
  affectedLot?: string;
  openedDate: string;      // formatted
  lastUpdated: string;
  owner: string;
};

export async function getQualityTickets(_customerId: string): Promise<QualityTicket[]> {
  return [
    {
      id: "qa-1",
      ticketNumber: "QA-2026-0142",
      name: "Dusty Capsules",
      description:
        "Dusty capsules in lot 1234 were identified. WB is working on gathering retains now.",
      status: "open",
      affectedLot: "Lot 1234",
      openedDate: "5/3/26",
      lastUpdated: "5/7/26",
      owner: "Marco Liu (WB Quality)",
    },
    {
      id: "qa-2",
      ticketNumber: "QA-2026-0128",
      name: "Under-Filled Capsules",
      description:
        "WB and client both affirmed 5% defect rate on under-filled capsules. Client given $5,000 credit.",
      status: "closed",
      decision: "$5,000 credit issued. Lot accepted with documented variance.",
      affectedLot: "Lot 1188",
      openedDate: "4/22/26",
      lastUpdated: "4/30/26",
      owner: "Marco Liu (WB Quality)",
    },
  ];
}

export const QUALITY_STATUS_META: Record<
  QualityStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  open: { label: "Open", tone: "warning" },
  in_review: { label: "In Review", tone: "info" },
  closed: { label: "Closed", tone: "success" },
};
