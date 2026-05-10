/**
 * Acumatica Production Order — Manufacturing endpoint.
 *
 * Endpoint: /entity/Manufacturing/{version}/ProductionOrder
 * Composite key: OrderType + ProductionNbr.
 *
 * This drives the portal's "your blend is in production" status — link
 * SalesOrder → SOSource → ProductionOrder via the `SalesOrderNbr` reference
 * field on the production order, then surface schedule + completion %.
 */

import { mfgEntityUrl, getAcumaticaConfig } from "./config";
import { getList, request } from "./client";
import { andFilter, odataDate, odataQuery, odataString } from "./utils";
import type { EntityEnvelope, Field } from "./types";

export type AcumaticaProductionOrder = EntityEnvelope & {
  OrderType: Field<string>;
  ProductionNbr: Field<string>;
  InventoryID: Field<string>;
  Warehouse: Field<string>;
  BOMID: Field<string>;
  Revision: Field<string>;
  Status: Field<"Planned" | "Released" | "In Process" | "Completed" | "Closed" | "Cancelled" | "On Hold" | string>;
  StartDate: Field<string>;
  EndDate: Field<string>;
  QtyToProduce: Field<number>;
  QtyComplete: Field<number>;
  QtyScrapped: Field<number>;
  /** Reference back to the originating SO line, if production was generated from one. */
  SourceOrderType: Field<string>;
  SourceOrderNbr: Field<string>;
  SourceOrderLineNbr: Field<number>;
};

const FIELDS = [
  "OrderType", "ProductionNbr", "InventoryID", "Warehouse", "BOMID", "Revision",
  "Status", "StartDate", "EndDate", "QtyToProduce", "QtyComplete", "QtyScrapped",
  "SourceOrderType", "SourceOrderNbr", "SourceOrderLineNbr",
];

export type FetchProductionOrdersParams = {
  /** Source sales order — most common filter for the portal. */
  sourceSalesOrderNbr?: string;
  inventoryId?: string;
  status?: AcumaticaProductionOrder["Status"]["value"];
  startedAfter?: Date;
  startedBefore?: Date;
};

export async function fetchProductionOrders(
  params: FetchProductionOrdersParams = {},
): Promise<AcumaticaProductionOrder[]> {
  const cfg = getAcumaticaConfig();
  const filter = andFilter(
    params.sourceSalesOrderNbr && `SourceOrderNbr eq ${odataString(params.sourceSalesOrderNbr)}`,
    params.inventoryId && `InventoryID eq ${odataString(params.inventoryId)}`,
    params.status && `Status eq ${odataString(String(params.status))}`,
    params.startedAfter && `StartDate ge ${odataDate(params.startedAfter)}`,
    params.startedBefore && `StartDate le ${odataDate(params.startedBefore)}`,
  );
  const qs = odataQuery({ filter, select: FIELDS, orderby: "StartDate desc" });
  return getList<AcumaticaProductionOrder>(mfgEntityUrl(cfg, `ProductionOrder${qs}`));
}

export async function fetchProductionOrder(orderType: string, productionNbr: string): Promise<AcumaticaProductionOrder> {
  const cfg = getAcumaticaConfig();
  const url = mfgEntityUrl(
    cfg,
    `ProductionOrder/${encodeURIComponent(orderType)}/${encodeURIComponent(productionNbr)}`,
  );
  return request<AcumaticaProductionOrder>(url);
}
