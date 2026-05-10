/**
 * Acumatica StockItem entity — the SKU catalog for a manufacturer.
 *
 * Endpoint: /entity/Default/{version}/StockItem
 * Key:      InventoryID (e.g. "BLD-IMM-100").
 *
 * The portal uses this primarily as a lookup so SalesOrder lines can be
 * enriched with a `category` (ItemClass) and a friendlier display name.
 * For stock-on-hand quantities, see `inventory-summary.ts`.
 */

import { entityUrl, getAcumaticaConfig } from "./config";
import { getList, request } from "./client";
import { odataQuery } from "./utils";
import type { EntityEnvelope, Field } from "./types";

export type AcumaticaStockItem = EntityEnvelope & {
  InventoryID: Field<string>;
  Description: Field<string>;
  ItemStatus: Field<"Active" | "No Sales" | "No Purchases" | "Inactive" | "Marked for Deletion" | string>;
  ItemClass: Field<string>;
  BaseUOM: Field<string>;
  SalesUOM: Field<string>;
  DefaultPrice: Field<number>;
  LastCost: Field<number>;
  /** WB Blends: Capsules / Powders / Liquids — typically a UDF on ItemClass. */
  ProductCategory?: Field<string>;
};

const FIELDS = [
  "InventoryID", "Description", "ItemStatus", "ItemClass",
  "BaseUOM", "SalesUOM", "DefaultPrice", "LastCost",
];

export async function fetchStockItem(inventoryId: string): Promise<AcumaticaStockItem> {
  const cfg = getAcumaticaConfig();
  return request<AcumaticaStockItem>(entityUrl(cfg, `StockItem/${encodeURIComponent(inventoryId)}`));
}

export type FetchStockItemsParams = {
  itemClass?: string;
  activeOnly?: boolean;
};

export async function fetchStockItems(params: FetchStockItemsParams = {}): Promise<AcumaticaStockItem[]> {
  const cfg = getAcumaticaConfig();
  const clauses: string[] = [];
  if (params.itemClass) clauses.push(`ItemClass eq '${params.itemClass.replace(/'/g, "''")}'`);
  if (params.activeOnly) clauses.push(`ItemStatus eq 'Active'`);
  const qs = odataQuery({
    filter: clauses.length ? clauses.join(" and ") : undefined,
    select: FIELDS,
    orderby: "InventoryID",
  });
  return getList<AcumaticaStockItem>(entityUrl(cfg, `StockItem${qs}`));
}
