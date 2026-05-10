/**
 * Acumatica AR Payment entity (cash receipts and customer payments).
 *
 * Endpoint: /entity/Default/{version}/Payment
 * Composite key: Type + ReferenceNbr.
 *
 * Use this for the portal's "Payment History" view and the per-invoice
 * "Apply Payment" allocation list (`DocumentsToApply`).
 */

import { entityUrl, getAcumaticaConfig } from "./config";
import { getList, request } from "./client";
import { andFilter, odataDate, odataQuery, odataString } from "./utils";
import type { EntityEnvelope, Field } from "./types";

export type AcumaticaPayment = EntityEnvelope & {
  Type: Field<"Payment" | "Prepayment" | "Refund" | "Voided Payment" | string>;
  ReferenceNbr: Field<string>;
  Customer: Field<string>;
  Location: Field<string>;
  PaymentMethod: Field<string>;
  ApplicationDate: Field<string>;
  PaymentRef: Field<string>;
  Status: Field<"Open" | "Balanced" | "Closed" | "Voided" | "Reserved" | string>;
  PaymentAmount: Field<number>;
  UnappliedBalance: Field<number>;
  Hold: Field<boolean>;
  DocumentsToApply?: Array<{
    DocType: Field<string>;
    ReferenceNbr: Field<string>;
    AmountPaid: Field<number>;
  }>;
};

const FIELDS = [
  "Type", "ReferenceNbr", "Customer", "Location", "PaymentMethod",
  "ApplicationDate", "PaymentRef", "Status", "PaymentAmount", "UnappliedBalance", "Hold",
];

export type FetchPaymentsParams = {
  customerId: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export async function fetchPayments(params: FetchPaymentsParams): Promise<AcumaticaPayment[]> {
  const cfg = getAcumaticaConfig();
  const filter = andFilter(
    `Customer eq ${odataString(params.customerId)}`,
    params.dateFrom && `ApplicationDate ge ${odataDate(params.dateFrom)}`,
    params.dateTo && `ApplicationDate le ${odataDate(params.dateTo)}`,
  );
  const qs = odataQuery({ filter, select: FIELDS, orderby: "ApplicationDate desc" });
  return getList<AcumaticaPayment>(entityUrl(cfg, `Payment${qs}`));
}

export async function fetchPayment(type: string, referenceNbr: string): Promise<AcumaticaPayment> {
  const cfg = getAcumaticaConfig();
  const qs = odataQuery({ expand: ["DocumentsToApply"] });
  const url = entityUrl(
    cfg,
    `Payment/${encodeURIComponent(type)}/${encodeURIComponent(referenceNbr)}${qs}`,
  );
  return request<AcumaticaPayment>(url);
}
