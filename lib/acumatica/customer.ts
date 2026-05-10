/**
 * Acumatica Customer entity.
 *
 * Endpoint: GET /entity/Default/{version}/Customer/{CustomerID}
 * Docs:    help.acumatica.com → Customer entity (Contract-Based REST API)
 *
 * Fields below are the subset the portal cares about today. Always cross-check
 * against the live tenant's swagger before extending — field availability
 * differs between Default and DefaultExt endpoints and across versions.
 */

import type { CustomerProfile } from "@/lib/data/types";
import { entityUrl, getAcumaticaConfig } from "./config";
import { request } from "./client";
import { odataQuery } from "./utils";
import type { EntityEnvelope, Field } from "./types";
import { v } from "./utils";

export type AcumaticaCustomer = EntityEnvelope & {
  CustomerID: Field<string>;
  CustomerName: Field<string>;
  Status: Field<"Active" | "OneTime" | "Hold" | "CreditHold" | "Inactive" | string>;
  CustomerClass: Field<string>;
  PrimaryContact?: {
    Email: Field<string>;
    DisplayName: Field<string>;
    Phone1: Field<string>;
  };
  CreatedDateTime?: Field<string>; // ISO
};

const CUSTOMER_FIELDS = [
  "CustomerID",
  "CustomerName",
  "Status",
  "CustomerClass",
  "PrimaryContact/Email",
  "PrimaryContact/DisplayName",
  "PrimaryContact/Phone1",
  "CreatedDateTime",
];

/** Fetch a single customer by its CustomerID (e.g. "C-1042"). */
export async function fetchCustomer(customerId: string): Promise<AcumaticaCustomer> {
  const cfg = getAcumaticaConfig();
  const qs = odataQuery({ select: CUSTOMER_FIELDS, expand: ["PrimaryContact"] });
  const url = entityUrl(cfg, `Customer/${encodeURIComponent(customerId)}${qs}`);
  return request<AcumaticaCustomer>(url);
}

/** Map an Acumatica Customer record to the portal's `CustomerProfile`. */
export function toCustomerProfile(c: AcumaticaCustomer): CustomerProfile {
  const created = v(c.CreatedDateTime);
  const accountSince = created ? new Date(created).getFullYear() : new Date().getFullYear();
  return {
    id: v(c.CustomerID) ?? "",
    name: v(c.CustomerName) ?? "",
    primaryContact: v(c.PrimaryContact?.DisplayName) ?? "",
    accountSince,
  };
}
