/**
 * Inventory Summary inquiry — stock-on-hand by warehouse / location.
 *
 * Endpoint: /entity/Default/{version}/InventorySummaryInquiry  (PUT)
 *
 * Inquiry-style endpoints are NOT GETs with $filter — Acumatica models them as
 * a record where you PUT the input parameters and read the response. Pattern:
 *
 *   PUT /InventorySummaryInquiry
 *   Body: { InventoryID: { value: "BLD-IMM-100" }, ExpandByLotSerialNbr: { value: false } }
 *   Response: same record with Results[] populated.
 */

import { entityUrl, getAcumaticaConfig } from "./config";
import { request } from "./client";
import type { EntityEnvelope, Field } from "./types";
import { pack } from "./utils";

export type InventorySummaryRow = {
  InventoryID: Field<string>;
  WarehouseID: Field<string>;
  Location: Field<string>;
  LotSerialNbr: Field<string>;
  ExpirationDate: Field<string>;
  QtyOnHand: Field<number>;
  QtyAvailable: Field<number>;
  QtyAvailableForShipment: Field<number>;
  BaseUOM: Field<string>;
};

export type AcumaticaInventorySummary = EntityEnvelope & {
  InventoryID: Field<string>;
  WarehouseID: Field<string>;
  ExpandByLotSerialNbr: Field<boolean>;
  Results?: InventorySummaryRow[];
};

export type FetchInventorySummaryParams = {
  inventoryId: string;
  warehouseId?: string;
  expandByLot?: boolean;
};

export async function fetchInventorySummary(
  params: FetchInventorySummaryParams,
): Promise<InventorySummaryRow[]> {
  const cfg = getAcumaticaConfig();
  const body: Partial<AcumaticaInventorySummary> = {
    InventoryID: pack(params.inventoryId),
    ExpandByLotSerialNbr: pack(params.expandByLot ?? false),
  };
  if (params.warehouseId) body.WarehouseID = pack(params.warehouseId);

  const res = await request<AcumaticaInventorySummary>(
    entityUrl(cfg, "InventorySummaryInquiry"),
    { method: "PUT", body },
  );
  return res.Results ?? [];
}
