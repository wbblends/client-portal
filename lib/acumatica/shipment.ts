/**
 * Acumatica Shipment entity.
 *
 * Endpoint: /entity/Default/{version}/Shipment
 * Key:      ShipmentNbr.
 *
 * Shipments don't have a customer field directly. Two access patterns:
 *   - Per sales order: $expand=Shipments on SalesOrder, or
 *   - Per shipment number: filter on `Orders/OrderNbr` after expanding `Orders`.
 *
 * For the portal "Tracking" view, we typically fan out: load the customer's
 * recent SalesOrders flat, collect each `Shipments[].ShipmentNbr`, and
 * fetch shipment detail (with `Packages` expanded) on demand for tracking #.
 */

import { entityUrl, getAcumaticaConfig } from "./config";
import { getList, request } from "./client";
import { andFilter, odataDate, odataQuery, odataString } from "./utils";
import type { EntityEnvelope, Field } from "./types";

export type AcumaticaShipmentPackage = {
  PackageNbr: Field<string>;
  BoxID: Field<string>;
  TrackingNbr: Field<string>;
  Weight: Field<number>;
};

export type AcumaticaShipmentDetail = {
  LineNbr: Field<number>;
  OrderType: Field<string>;
  OrderNbr: Field<string>;
  InventoryID: Field<string>;
  ShippedQty: Field<number>;
  UOM: Field<string>;
  Description: Field<string>;
};

export type AcumaticaShipment = EntityEnvelope & {
  ShipmentNbr: Field<string>;
  Type: Field<"Shipment" | "Transfer" | "Receipt" | string>;
  Status: Field<"Open" | "Released" | "Confirmed" | "Cancelled" | string>;
  ShipmentDate: Field<string>;
  ShippedQty: Field<number>;
  ShippedVolume: Field<number>;
  ShippedWeight: Field<number>;
  WorkgroupID: Field<string>;
  CustomerID: Field<string>; // surfaced in Confirmed shipments
  ShipVia: Field<string>;    // carrier
  Packages?: AcumaticaShipmentPackage[];
  Details?: AcumaticaShipmentDetail[];
  Orders?: Array<{ OrderType: Field<string>; OrderNbr: Field<string> }>;
};

const LIST_FIELDS = [
  "ShipmentNbr", "Type", "Status", "ShipmentDate", "ShippedQty",
  "ShippedWeight", "CustomerID", "ShipVia",
];

export type FetchShipmentsParams = {
  customerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: AcumaticaShipment["Status"]["value"];
};

export async function fetchShipments(params: FetchShipmentsParams = {}): Promise<AcumaticaShipment[]> {
  const cfg = getAcumaticaConfig();
  const filter = andFilter(
    params.customerId && `CustomerID eq ${odataString(params.customerId)}`,
    params.dateFrom && `ShipmentDate ge ${odataDate(params.dateFrom)}`,
    params.dateTo && `ShipmentDate le ${odataDate(params.dateTo)}`,
    params.status && `Status eq ${odataString(String(params.status))}`,
  );
  const qs = odataQuery({ filter, select: LIST_FIELDS, orderby: "ShipmentDate desc" });
  return getList<AcumaticaShipment>(entityUrl(cfg, `Shipment${qs}`));
}

export async function fetchShipment(shipmentNbr: string): Promise<AcumaticaShipment> {
  const cfg = getAcumaticaConfig();
  const qs = odataQuery({ expand: ["Details", "Packages", "Orders"] });
  const url = entityUrl(cfg, `Shipment/${encodeURIComponent(shipmentNbr)}${qs}`);
  return request<AcumaticaShipment>(url);
}
