import { seededRng } from "@/lib/utils";

/**
 * Mirror of the weekly Friday "Open Order Status" report WB Blends sends to
 * customers today (PDF). Same column structure so the portal view drops in
 * without retraining the team's eye.
 *
 * Future: replace this loader with a join across Acumatica sales orders +
 * the proprietary label-approval system + production scheduling.
 */

export type OpenOrderType = "Capsules" | "Powders" | "Liquids";

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
};

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
    },
  ];
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
