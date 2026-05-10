/**
 * Acumatica integration barrel.
 *
 * Import sites should pull from `@/lib/acumatica` rather than reaching into
 * individual modules — keeps the eventual swap of mock loaders to real API
 * calls a one-line change.
 */

export * from "./types";
export * from "./config";
export * from "./customer";
export * from "./sales-order";
export * from "./invoice";
export * from "./payment";
export * from "./stock-item";
export * from "./inventory-summary";
export * from "./bill-of-material";
export * from "./production-order";
export * from "./shipment";
export * from "./file";
export { request, getList } from "./client";
export { getAccessToken, invalidateToken } from "./auth";
