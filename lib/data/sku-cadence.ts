/**
 * Estimated reorder cadence per SKU. These are estimates the WB sales team
 * keeps internally — they don't move when the customer changes the date
 * range, so we treat them as static metadata. Future: pull from the
 * proprietary forecasting model.
 */

export type WindowStatus = "open" | "idle" | "overdue";

export type CadenceInfo = {
  cadence: string;     // "Bi-monthly", "Monthly", "Quarterly", "Bi-annually"
  lastOrder: string;   // formatted month
  windowStatus: WindowStatus;
  /** Friendly label for the window column. */
  windowLabel: string;
};

/**
 * Static cadence map. Keyed by SKU. SKUs not present here fall through to a
 * default and won't show window flags.
 */
export const CADENCE: Record<string, CadenceInfo> = {
  "BLD-IMM-100": {
    cadence: "Bi-monthly",
    lastOrder: "Mar 2026",
    windowStatus: "open",
    windowLabel: "Order Window Open",
  },
  "BLD-MRT-100": {
    cadence: "Bi-monthly",
    lastOrder: "Feb 2026",
    windowStatus: "overdue",
    windowLabel: "Past Order Window",
  },
  "BLD-CLM-100": {
    cadence: "Monthly",
    lastOrder: "Apr 2026",
    windowStatus: "open",
    windowLabel: "Order Window Open",
  },
  "BLD-FOC-100": {
    cadence: "Quarterly",
    lastOrder: "Apr 2026",
    windowStatus: "idle",
    windowLabel: "In Stock",
  },
  "BLD-ENR-100": {
    cadence: "Bi-monthly",
    lastOrder: "Mar 2026",
    windowStatus: "open",
    windowLabel: "Order Window Open",
  },
  "BLD-SLP-100": {
    cadence: "Quarterly",
    lastOrder: "Mar 2026",
    windowStatus: "idle",
    windowLabel: "In Stock",
  },
  "BLD-WMN-100": {
    cadence: "Monthly",
    lastOrder: "Feb 2026",
    windowStatus: "overdue",
    windowLabel: "Past Order Window",
  },
  "RAW-ASH-100": {
    cadence: "Quarterly",
    lastOrder: "Apr 2026",
    windowStatus: "idle",
    windowLabel: "In Stock",
  },
  "RAW-RHO-50": {
    cadence: "Bi-annually",
    lastOrder: "Jan 2026",
    windowStatus: "idle",
    windowLabel: "In Stock",
  },
  "BLD-DGS-100": {
    cadence: "Quarterly",
    lastOrder: "Feb 2026",
    windowStatus: "open",
    windowLabel: "Order Window Open",
  },
};

export const WINDOW_TONE: Record<WindowStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  open: "success",
  idle: "neutral",
  overdue: "danger",
};
