import { seededRng } from "@/lib/utils";
import type { ExternalIds } from "./types";

/**
 * Mirror of the weekly Friday "Open Order Status" report WB Blends sends to
 * customers today (PDF). Same column structure so the portal view drops in
 * without retraining the team's eye.
 *
 * Future: replace this loader with a join across Acumatica sales orders +
 * the proprietary label-approval system + production scheduling. The
 * `externalIds` field on each row carries the source-system pointers needed
 * to deep-link back to either system.
 */

export type OpenOrderType = "Capsules" | "Powders" | "Liquids";

/** A single dated step in an order's lifecycle, used by the detail popover. */
export type OpenOrderTimelineEvent = {
  label: string;       // "PO received", "Raw materials in-house", "Bottling complete"
  date: string;        // "5/12/26" | "—"
  complete: boolean;
};

export type OpenOrderChangelogEntry = {
  date: string;        // "5/9/26"
  author: string;      // "Jordan Reyes"
  note: string;
};

export type OpenOrderDocument = {
  name: string;        // "FPS — Calm Adaptogen 60ct v3.pdf"
  href?: string;       // omitted in mock; real loader populates a signed URL
};

export type OpenOrder = {
  id: string;
  poNumber: string;        // "PO#lum_PO90"
  salesOrder: string;      // "CT003181"
  productName: string;     // "Daily Gut Detox (120ct)"
  type: OpenOrderType;
  quantity: number;        // 12000
  labelStatus: "Closed" | "Reviewed" | "In Review" | "Pending" | "—";
  labelApprovalDeadline: string; // "Approved" | "5/28/26" | "—"
  labelInhouseDeadline: string;  // "Arrived" | "6/5/26" | "—"
  rawMaterialInhouseDeadline?: string; // customer-supplied material
  estimatedShipDate: string; // "5/18/26"
  currentStatus: string;     // free-form note
  onTrack: "on_track" | "watch" | "at_risk";
  // Detail-card fields. Optional so the list loader can choose to omit them
  // and a `getOpenOrderById` round-trip can hydrate them on demand later.
  externalIds?: ExternalIds;
  productionLine?: string;   // "Encap Line 2"
  coaStatus?: "pending" | "drafted" | "released" | "n/a";
  contact?: { name: string; email: string };
  timeline?: OpenOrderTimelineEvent[];
  documents?: OpenOrderDocument[];
  changelog?: OpenOrderChangelogEntry[];
};

const DEFAULT_CONTACT = { name: "Jordan Reyes", email: "jordan.reyes@wbblends.com" };

export async function getOpenOrders(customerId: string): Promise<OpenOrder[]> {
  const rng = seededRng(hash(customerId) ^ 0x4f0c91);
  // Stable sample tuned to feel like a real Friday report — most lines on
  // track, one with a small flag, mix of label / raw material states.
  void rng;
  return [
    {
      id: "oo-1",
      poNumber: "PO#1042-118",
      salesOrder: "CT003402",
      productName: "Calm Adaptogen Blend (60ct)",
      type: "Capsules",
      quantity: 8400,
      labelStatus: "Closed",
      labelApprovalDeadline: "Approved",
      labelInhouseDeadline: "Arrived",
      estimatedShipDate: "5/22/26",
      currentStatus:
        "On track. Production scheduled for 5/19. Next step: WB to send pre-ship COA + finished product spec.",
      onTrack: "on_track",
      externalIds: { acumaticaId: "ACU-SO-CT003402", proprietarySystemId: "WB-LBL-440218" },
      productionLine: "Encap Line 2",
      coaStatus: "drafted",
      contact: DEFAULT_CONTACT,
      timeline: [
        { label: "PO received", date: "4/24/26", complete: true },
        { label: "Label approved", date: "5/2/26", complete: true },
        { label: "Raw materials in-house", date: "5/8/26", complete: true },
        { label: "Encapsulation", date: "5/19/26", complete: false },
        { label: "Pre-ship COA released", date: "5/21/26", complete: false },
        { label: "Ship", date: "5/22/26", complete: false },
      ],
      documents: [
        { name: "FPS — Calm Adaptogen 60ct v3.pdf" },
        { name: "Label proof — approved 5/2.pdf" },
      ],
      changelog: [
        { date: "5/8/26", author: "Marco Liu", note: "Raw material reconciliation passed FPS check." },
        { date: "5/2/26", author: "Jordan Reyes", note: "Customer approved label proof v3." },
      ],
    },
    {
      id: "oo-2",
      poNumber: "PO#1042-119",
      salesOrder: "CT003419",
      productName: "Immunity Blend Bulk (100lb)",
      type: "Powders",
      quantity: 24000,
      labelStatus: "—",
      labelApprovalDeadline: "—",
      labelInhouseDeadline: "—",
      estimatedShipDate: "6/5/26",
      currentStatus:
        "On track. Bulk powder — no label component. Blending starts 5/26 once raw materials reconcile against FPS.",
      onTrack: "on_track",
      externalIds: { acumaticaId: "ACU-SO-CT003419", proprietarySystemId: "WB-LBL-440219" },
      productionLine: "Blend Line A",
      coaStatus: "pending",
      contact: DEFAULT_CONTACT,
      timeline: [
        { label: "PO received", date: "4/30/26", complete: true },
        { label: "Raw materials in-house", date: "5/15/26", complete: true },
        { label: "Blending", date: "5/26/26", complete: false },
        { label: "QA hold + COA", date: "6/2/26", complete: false },
        { label: "Ship", date: "6/5/26", complete: false },
      ],
      documents: [{ name: "FPS — Immunity Bulk v2.pdf" }],
      changelog: [
        { date: "5/15/26", author: "Marco Liu", note: "Echinacea lot E-2204 cleared incoming QC." },
      ],
    },
    {
      id: "oo-3",
      poNumber: "PO#1042-120",
      salesOrder: "CT003428",
      productName: "Mushroom Trio Blend (90ct)",
      type: "Capsules",
      quantity: 12000,
      labelStatus: "Reviewed",
      labelApprovalDeadline: "5/19/26",
      labelInhouseDeadline: "5/30/26",
      estimatedShipDate: "6/12/26",
      currentStatus:
        "On track. Final label review with brand — reishi origin update. Next step: customer approval by 5/19.",
      onTrack: "watch",
      externalIds: { acumaticaId: "ACU-SO-CT003428", proprietarySystemId: "WB-LBL-440220" },
      productionLine: "Encap Line 1",
      coaStatus: "pending",
      contact: DEFAULT_CONTACT,
      timeline: [
        { label: "PO received", date: "5/1/26", complete: true },
        { label: "Label proof out for review", date: "5/12/26", complete: true },
        { label: "Customer approval", date: "5/19/26", complete: false },
        { label: "Labels in-house", date: "5/30/26", complete: false },
        { label: "Encapsulation", date: "6/9/26", complete: false },
        { label: "Ship", date: "6/12/26", complete: false },
      ],
      documents: [{ name: "Label proof v2 — reishi origin update.pdf" }],
      changelog: [
        { date: "5/12/26", author: "Jordan Reyes", note: "Updated reishi sourcing copy per FDA-NDI guidance and routed to brand for sign-off." },
      ],
    },
    {
      id: "oo-4",
      poNumber: "PO#1042-121",
      salesOrder: "CT003435",
      productName: "Sleep Botanical Tincture (1oz)",
      type: "Liquids",
      quantity: 6500,
      labelStatus: "Closed",
      labelApprovalDeadline: "Approved",
      labelInhouseDeadline: "Arrived",
      estimatedShipDate: "5/30/26",
      currentStatus:
        "On track. Bottling scheduled 5/27. Customer requested 3PL drop-ship to Walmart DC — confirmed with Western logistics.",
      onTrack: "on_track",
      externalIds: { acumaticaId: "ACU-SO-CT003435", proprietarySystemId: "WB-LBL-440221" },
      productionLine: "Liquids Line 1",
      coaStatus: "pending",
      contact: DEFAULT_CONTACT,
      timeline: [
        { label: "PO received", date: "5/4/26", complete: true },
        { label: "Labels arrived", date: "5/14/26", complete: true },
        { label: "Bottling", date: "5/27/26", complete: false },
        { label: "Drop-ship to Walmart DC", date: "5/30/26", complete: false },
      ],
      documents: [
        { name: "Walmart DC routing guide v6.pdf" },
        { name: "FPS — Sleep Tincture 1oz v1.pdf" },
      ],
      changelog: [
        { date: "5/9/26", author: "Priya Patel", note: "Confirmed Western Logistics carrier slot for 5/30." },
      ],
    },
    {
      id: "oo-5",
      poNumber: "PO#1042-122",
      salesOrder: "CT003441",
      productName: "Energy Botanical Blend (60ct)",
      type: "Capsules",
      quantity: 10000,
      labelStatus: "Reviewed",
      labelApprovalDeadline: "5/14/26",
      labelInhouseDeadline: "5/22/26",
      rawMaterialInhouseDeadline: "5/30/26",
      estimatedShipDate: "6/26/26",
      currentStatus:
        "Watching. Customer-supplied turmeric extract delayed 4 days by overseas freight; built recovery into encap schedule. Will update next Friday.",
      onTrack: "watch",
      externalIds: { acumaticaId: "ACU-SO-CT003441", proprietarySystemId: "WB-LBL-440222" },
      productionLine: "Encap Line 2",
      coaStatus: "pending",
      contact: DEFAULT_CONTACT,
      timeline: [
        { label: "PO received", date: "5/2/26", complete: true },
        { label: "Label approved", date: "5/14/26", complete: false },
        { label: "Customer-supplied turmeric arrives", date: "5/30/26", complete: false },
        { label: "Encapsulation", date: "6/22/26", complete: false },
        { label: "Ship", date: "6/26/26", complete: false },
      ],
      documents: [{ name: "Turmeric COA — supplier-provided.pdf" }],
      changelog: [
        { date: "5/9/26", author: "Jordan Reyes", note: "Freight ETA pushed from 5/26 → 5/30. Encap rebooked." },
      ],
    },
    {
      id: "oo-6",
      poNumber: "PO#1042-123",
      salesOrder: "CT003456",
      productName: "Women's Wellness Blend (90ct)",
      type: "Capsules",
      quantity: 9000,
      labelStatus: "Closed",
      labelApprovalDeadline: "Approved",
      labelInhouseDeadline: "Arrived",
      estimatedShipDate: "7/3/26",
      currentStatus:
        "On track. Allocated to production line 2 the week of 6/23. Pallet config confirmed for Vitacost DC.",
      onTrack: "on_track",
      externalIds: { acumaticaId: "ACU-SO-CT003456", proprietarySystemId: "WB-LBL-440223" },
      productionLine: "Encap Line 2",
      coaStatus: "pending",
      contact: DEFAULT_CONTACT,
      timeline: [
        { label: "PO received", date: "5/5/26", complete: true },
        { label: "Labels arrived", date: "5/19/26", complete: true },
        { label: "Encapsulation", date: "6/24/26", complete: false },
        { label: "Ship", date: "7/3/26", complete: false },
      ],
      documents: [
        { name: "Vitacost pallet config v2.pdf" },
        { name: "FPS — Women's Wellness 90ct v4.pdf" },
      ],
      changelog: [
        { date: "5/9/26", author: "Priya Patel", note: "Pallet config approved by Vitacost." },
      ],
    },
  ];
}

/**
 * Detail lookup for a single open order. The list loader already populates
 * the rich fields today; once the real backend lands this becomes a single
 * `acumatica.salesOrders.get(id)` call with a join into the proprietary
 * label-approval system.
 */
export async function getOpenOrderById(
  customerId: string,
  id: string,
): Promise<OpenOrder | null> {
  const all = await getOpenOrders(customerId);
  return all.find(o => o.id === id) ?? null;
}

export const ON_TRACK_META: Record<
  OpenOrder["onTrack"],
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  on_track: { label: "On Track", tone: "success" },
  watch: { label: "Watching", tone: "warning" },
  at_risk: { label: "At Risk", tone: "danger" },
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}
