# Acumatica integration

Scaffold for the Acumatica Contract-Based REST API. Nothing here is wired into
the portal yet — every page still reads from `lib/data/*.ts` mock loaders. When
the credentials and instance are ready, swap each mock loader's body to call
the corresponding function in this folder.

## Layout

| File | Purpose |
|------|---------|
| `config.ts` | Env-driven config + URL builders (`entityUrl`, `mfgEntityUrl`, `fileUrl`). |
| `auth.ts` | OAuth 2.0 token acquisition + in-process cache + refresh. |
| `client.ts` | Fetch wrapper: bearer auth, 401 re-auth, 429/5xx retry, 511 page-shrink, OData pagination. |
| `types.ts` | `Field<T>`, `Unwrap<T>`, file refs, `AcumaticaApiError`. |
| `utils.ts` | `v()` unwrap, OData filter/date helpers. |
| `customer.ts` | `Customer` entity → `CustomerProfile`. |
| `sales-order.ts` | `SalesOrder` entity → `OrderLine[]`. |
| `invoice.ts` | `SalesInvoice` (AR) → `Invoice`. |
| `payment.ts` | AR `Payment` (cash receipts). |
| `stock-item.ts` | `StockItem` SKU catalog (lookup for line enrichment). |
| `inventory-summary.ts` | Stock-on-hand inquiry (PUT-style endpoint). |
| `bill-of-material.ts` | `BillOfMaterial` — Manufacturing endpoint. |
| `production-order.ts` | `ProductionOrder` — Manufacturing endpoint. |
| `shipment.ts` | `Shipment` (Confirmed shipments + tracking #). |
| `file.ts` | Download attached files (PDFs, COAs) by GUID. |
| `index.ts` | Barrel — import from `@/lib/acumatica`. |

## Endpoints used

| Portal feature | Acumatica endpoint | Method |
|---|---|---|
| Customer profile | `Default/Customer/{CustomerID}` | GET |
| Order history | `Default/SalesOrder?$filter=CustomerID eq …` | GET |
| Order detail (with lines) | `Default/SalesOrder/{type}/{nbr}?$expand=Details,Shipments` | GET |
| Open Order Status report | `Default/SalesOrder` ⨝ `Manufacturing/ProductionOrder` ⨝ `Default/Shipment` | GET (multi) |
| Invoices | `Default/SalesInvoice?$filter=Customer eq …` | GET |
| Payment history | `Default/Payment?$filter=Customer eq …` | GET |
| SKU catalog | `Default/StockItem` | GET |
| Stock on hand | `Default/InventorySummaryInquiry` | PUT |
| Bill of Materials | `Manufacturing/BillOfMaterial/{BOMID}/{Revision}` | GET |
| Production status | `Manufacturing/ProductionOrder?$filter=SourceOrderNbr eq …` | GET |
| Shipment tracking | `Default/Shipment/{ShipmentNbr}?$expand=Packages` | GET |
| Document download (COA, SO PDF) | `Default/files/{fileId}` | GET (binary) |

Two endpoint roots are in play: **`Default`** for AR / sales / inventory and
**`Manufacturing`** for BOMs and production orders. They share an instance and
session but have separate Swagger docs and version streams.

## Required environment variables

Set these in Vercel → Project Settings → Environment Variables (or in a local
`.env.local` for dev). See `.env.example` at the repo root for the full list.

```
ACUMATICA_BASE_URL=https://wbblends.acumatica.com
ACUMATICA_TENANT=WBBlends
ACUMATICA_OAUTH_CLIENT_ID=<guid>@WBBlends
ACUMATICA_OAUTH_CLIENT_SECRET=...
ACUMATICA_OAUTH_USERNAME=portal-svc
ACUMATICA_OAUTH_PASSWORD=...
ACUMATICA_ENDPOINT_VERSION=24.200.001       # PIN — don't use "Latest"
```

Optional:

```
ACUMATICA_DEFAULT_ENDPOINT=Default
ACUMATICA_MFG_ENDPOINT=Manufacturing
ACUMATICA_OAUTH_SCOPE=api offline_access    # add api:concurrent_access if seats are tight
ACUMATICA_REQUEST_TIMEOUT_MS=30000
ACUMATICA_MAX_PAGE_SIZE=200
```

## Wiring up — example

Each `lib/data/*.ts` mock loader has a one-line replacement when the API is
ready. For example, `lib/data/customer.ts`:

```ts
// Before (mock):
return { id: customerId, name: customerNames[customerId] ?? "...", ... };

// After:
import { fetchCustomer, toCustomerProfile } from "@/lib/acumatica";
return toCustomerProfile(await fetchCustomer(customerId));
```

The portal session already carries the `customerId` (see `lib/auth.ts`), so
every page can scope reads to a single customer without further plumbing.

## Connected Application setup (Acumatica side)

Done once per environment, by an Acumatica admin:

1. **Web Service Endpoints (SM207060)** — confirm `Default` and `Manufacturing`
   endpoints are published and note the version (`24.200.001`, `25.100.001`,
   etc). Pin that version in `ACUMATICA_ENDPOINT_VERSION`.
2. **Connected Applications (SM303010)** — add a new entry, OAuth 2.0,
   "Resource Owner Password" flow. Copy the Client ID
   (`<guid>@<TenantID>`) + Secret into env vars.
3. **Users (SM201010)** — create a service account user (e.g. `portal-svc`)
   with a role limited to read-only access on the entities used here
   (Customer, Sales Order, Invoice, Payment, Stock Item, BOM, Production
   Order, Shipment) plus the inquiry screens.
4. **License Monitoring Console** — confirm the tenant has spare API session
   seats. Add `api:concurrent_access` to the OAuth scope if usage is tight.

## Things this scaffold does NOT yet handle

- **Custom (UDF) fields.** If WB Blends has user-defined fields on Customer
  (label-approval status, account manager, etc.), add them via `$custom=` in
  `odataQuery`. Type-side: extend `EntityEnvelope.custom`.
- **Webhooks / push.** Acumatica supports outbound webhooks for change events.
  Useful for invalidating Next.js cache (`revalidateTag`) when an order status
  changes. Not wired up.
- **The proprietary system join.** The "Open Order Status" report (mock at
  `lib/data/open-orders.ts`) merges Acumatica data with WB Blends'
  label-approval system. That second source isn't covered here.
- **Report PDFs.** Sales Order / Invoice PDFs in Acumatica's UI are rendered
  by the Reports engine, not file attachments. Either configure a workflow
  to attach them on save (then `file.ts` works), or call the Reports REST
  API separately.

## Reference docs

- Contract-Based REST API hub: <https://help.acumatica.com/Wiki/ShowWiki.aspx?pageid=735fad82-9cf3-4a2c-8538-1c8344aba844>
- OAuth 2.0 client setup: <https://help.acumatica.com/Help?ScreenId=ShowWiki&pageid=a8f71c44-9f5c-4af8-9d47-bc815c8a58e7>
- Integration Development Guide PDF: <https://www.acumatica.com/media/2020/09/AcumaticaERP_IntegrationDevelopmentGuide.pdf>
- Each tenant's live Swagger: `{baseUrl}/entity/{Endpoint}/{Version}/swagger.json?company={Company}` — always cross-check field names here, they vary by version and customization.
