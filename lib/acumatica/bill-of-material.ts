/**
 * Acumatica Bill of Material — for the Manufacturing edition.
 *
 * Endpoint: /entity/Manufacturing/{version}/BillOfMaterial   (NOT Default)
 * Composite key: BOMID + Revision.
 *
 * The portal uses this to surface a customer's blend recipe (ingredients,
 * percentages, target yields). Most customers will have *finalized* BOMs
 * marked as `Active` for the revision they're currently producing against.
 */

import { mfgEntityUrl, getAcumaticaConfig } from "./config";
import { getList, request } from "./client";
import { odataQuery, odataString } from "./utils";
import type { EntityEnvelope, Field } from "./types";

export type AcumaticaBOMMaterial = {
  LineNbr: Field<number>;
  Operation: Field<string>;
  InventoryID: Field<string>;
  Description: Field<string>;
  UOM: Field<string>;
  QtyRequired: Field<number>;
  ScrapFactor: Field<number>;
  BatchSize: Field<number>;
};

export type AcumaticaBillOfMaterial = EntityEnvelope & {
  BOMID: Field<string>;
  Revision: Field<string>;
  InventoryID: Field<string>;       // finished good this BOM produces
  Warehouse: Field<string>;
  Status: Field<"Active" | "On Hold" | "Archived" | string>;
  EffectiveDate: Field<string>;
  ExpirationDate: Field<string>;
  Description: Field<string>;
  Materials?: AcumaticaBOMMaterial[];
};

export async function fetchBillOfMaterial(bomId: string, revision: string): Promise<AcumaticaBillOfMaterial> {
  const cfg = getAcumaticaConfig();
  const qs = odataQuery({ expand: ["Materials"] });
  const url = mfgEntityUrl(
    cfg,
    `BillOfMaterial/${encodeURIComponent(bomId)}/${encodeURIComponent(revision)}${qs}`,
  );
  return request<AcumaticaBillOfMaterial>(url);
}

export type FetchBOMsParams = {
  inventoryId?: string;
  status?: AcumaticaBillOfMaterial["Status"]["value"];
};

export async function fetchBillsOfMaterial(params: FetchBOMsParams = {}): Promise<AcumaticaBillOfMaterial[]> {
  const cfg = getAcumaticaConfig();
  const clauses: string[] = [];
  if (params.inventoryId) clauses.push(`InventoryID eq ${odataString(params.inventoryId)}`);
  if (params.status) clauses.push(`Status eq ${odataString(String(params.status))}`);
  const qs = odataQuery({
    filter: clauses.length ? clauses.join(" and ") : undefined,
    orderby: "InventoryID",
  });
  return getList<AcumaticaBillOfMaterial>(mfgEntityUrl(cfg, `BillOfMaterial${qs}`));
}
