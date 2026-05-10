/**
 * Acumatica SalesOrder entity.
 *
 * Endpoint: /entity/Default/{version}/SalesOrder
 * Composite key: OrderType + OrderNbr (e.g. "SO" + "000123").
 *
 * Filtering by customer:
 *   $filter=CustomerID eq 'C-1042' and Date ge datetimeoffset'2026-01-01T00:00:00Z'
 *
 * Cost note: do NOT $expand=Details on broad list calls — line collections can
 * 10-100x the payload. Fetch the list flat, then call `fetchSalesOrder()` per
 * detail page to expand.
 */

import type { OrderLine, OrderStatus } from "@/lib/data/types";
import { entityUrl, getAcumaticaConfig } from "./config";
import { getList, request } from "./client";
import { andFilter, odataDate, odataQuery, odataString, parseAcumaticaDate, v } from "./utils";
import type { EntityEnvelope, Field } from "./types";

export type AcumaticaSalesOrderDetail = {
  LineNbr: Field<number>;
  InventoryID: Field<string>;
  LineDescription: Field<string>;
  OrderQty: Field<number>;
  UnitPrice: Field<number>;
  ExtendedPrice: Field<number>;
  RequestedOn: Field<string>;
  ShippedQty: Field<number>;
};

export type AcumaticaSalesOrder = EntityEnvelope & {
  OrderType: Field<string>;
  OrderNbr: Field<string>;
  CustomerID: Field<string>;
  Date: Field<string>;
  RequestedOn: Field<string>;
  ScheduledShipmentDate?: Field<string>;
  Status: Field<"Open" | "Hold" | "Completed" | "Shipping" | "Cancelled" | "Back Order" | string>;
  CustomerOrder: Field<string>; // customer-side PO number
  OrderTotal: Field<number>;
  Details?: AcumaticaSalesOrderDetail[];
  Shipments?: Array<{ ShipmentNbr: Field<string>; ShipmentDate: Field<string>; Status: Field<string> }>;
};

const LIST_FIELDS = [
  "OrderType", "OrderNbr", "CustomerID", "Date", "RequestedOn",
  "ScheduledShipmentDate", "Status", "CustomerOrder", "OrderTotal",
];

const DETAIL_FIELDS = [
  "LineNbr", "InventoryID", "LineDescription", "OrderQty",
  "UnitPrice", "ExtendedPrice", "RequestedOn", "ShippedQty",
];

export type FetchSalesOrdersParams = {
  customerId: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: AcumaticaSalesOrder["Status"]["value"];
};

export async function fetchSalesOrders(params: FetchSalesOrdersParams): Promise<AcumaticaSalesOrder[]> {
  const cfg = getAcumaticaConfig();
  const filter = andFilter(
    `CustomerID eq ${odataString(params.customerId)}`,
    params.dateFrom && `Date ge ${odataDate(params.dateFrom)}`,
    params.dateTo && `Date le ${odataDate(params.dateTo)}`,
    params.status && `Status eq ${odataString(String(params.status))}`,
  );
  const qs = odataQuery({ filter, select: LIST_FIELDS, orderby: "Date desc" });
  const url = entityUrl(cfg, `SalesOrder${qs}`);
  return getList<AcumaticaSalesOrder>(url);
}

/** Fetch a single order **with** line details. Composite key: OrderType + OrderNbr. */
export async function fetchSalesOrder(orderType: string, orderNbr: string): Promise<AcumaticaSalesOrder> {
  const cfg = getAcumaticaConfig();
  const qs = odataQuery({
    select: [...LIST_FIELDS, ...DETAIL_FIELDS.map(f => `Details/${f}`)],
    expand: ["Details", "Shipments"],
  });
  const url = entityUrl(
    cfg,
    `SalesOrder/${encodeURIComponent(orderType)}/${encodeURIComponent(orderNbr)}${qs}`,
  );
  return request<AcumaticaSalesOrder>(url);
}

/**
 * Flatten an Acumatica SalesOrder (with `Details` expanded) into the portal's
 * line-oriented `OrderLine[]`. Caller is responsible for expanding details
 * before invoking — `fetchSalesOrder()` does, `fetchSalesOrders()` does not.
 */
export function toOrderLines(so: AcumaticaSalesOrder): OrderLine[] {
  const orderDate = parseAcumaticaDate(v(so.Date)) ?? new Date();
  const promised = parseAcumaticaDate(v(so.ScheduledShipmentDate) ?? v(so.RequestedOn)) ?? orderDate;
  const status = mapStatus(v(so.Status));
  const poNumber = v(so.CustomerOrder) ?? `${v(so.OrderType) ?? ""}${v(so.OrderNbr) ?? ""}`;
  const firstShipment = so.Shipments?.[0];
  const shippedDate = parseAcumaticaDate(v(firstShipment?.ShipmentDate));

  const details = so.Details ?? [];
  return details.map((d): OrderLine => {
    const units = v(d.OrderQty) ?? 0;
    const unitPrice = v(d.UnitPrice) ?? 0;
    const amount = v(d.ExtendedPrice) ?? units * unitPrice;
    return {
      id: `${v(so.OrderNbr)}-${v(d.LineNbr)}`,
      poNumber,
      orderDate,
      promisedDate: promised,
      shippedDate,
      deliveredDate: null,
      sku: v(d.InventoryID) ?? "",
      skuName: v(d.LineDescription) ?? "",
      // Acumatica's category lives on the StockItem, not the SO line — populate
      // post-hoc by joining against the inventory item cache.
      category: "",
      units,
      unitPrice,
      amount,
      status,
    };
  });
}

function mapStatus(s: string | null): OrderStatus {
  switch (s) {
    case "Open":
    case "Hold":
    case "Back Order":
      return "open";
    case "Shipping":
      return "shipped";
    case "Completed":
      return "delivered";
    case "Cancelled":
      return "canceled";
    default:
      return "open";
  }
}
