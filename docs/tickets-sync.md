# Tickets sync — coworker integration

The admin Tickets page at `/admin/tickets` is fed by a daily POST from the
7 AM coworker job. This doc captures the contract and a sample prompt you can
drop into the coworker.

## How it fits together

1. Coworker generates `wb_open_tickets_YYYY-MM-DD.xlsx` as it does today.
2. Same coworker run parses each sheet and POSTs the rows to
   `https://<portal>/api/tickets/sync` as JSON.
3. The portal upserts each ticket by `(tab, id)`, leaving the user's `rank` +
   `color` annotations alone. Tickets that disappear from the payload are
   soft-deleted; if they reappear later, their old annotations come back.

## Endpoint

```
POST  /api/tickets/sync
Headers:
  Authorization: Bearer <TICKETS_SYNC_TOKEN>
  Content-Type: application/json
Body:
  {
    "tickets": [
      {
        "tab":         "Quote",            // sheet name → portal tab
        "id":          "10048",            // string; required
        "version":     "10048v1",
        "name":        "Cleanse",
        "productType": "Capsules",
        "customer":    "Ancient Nutrition",
        "salesperson": "Landon Penrod",
        "status":      "Open",
        "openDate":    "4/16/26",          // any string; portal displays as-is
        "dueDate":     "4/23/26"
      },
      ...
    ]
  }
```

Response shape:

```json
{ "ok": true, "inserted": 12, "updated": 304, "softDeleted": 5, "total": 316 }
```

## Auth

Set `TICKETS_SYNC_TOKEN` in the portal's environment to a long random string
(e.g. `openssl rand -base64 48`). The coworker sends it as
`Authorization: Bearer <token>`. Without the env var the endpoint returns
503; with a wrong token it returns 401.

## Tab names

Use the sheet names verbatim — the portal builds its tab strip from whatever
distinct `tab` values come back in the payload. The current spreadsheet has:

- `Quote`
- `Requote`
- `R&D`
- `Document Request`
- `SFP`
- `FPS`
- `Label Review`
- `Certification`

## Sheet → field mapping

All eight sheets have the nine base fields in some form. A couple use a
slightly different column name; map them all to the JSON keys above:

| JSON key      | Source column name(s)             |
|---------------|-----------------------------------|
| `id`          | `ID`                              |
| `version`     | `Version`                         |
| `name`        | `Name`                            |
| `productType` | `Product Type`                    |
| `customer`    | `Customer`                        |
| `salesperson` | `Salesperson`                     |
| `status`      | `Status`                          |
| `openDate`    | `Open Date` (or first date col)   |
| `dueDate`     | `Due Date`, `V1 Due Date` (FPS)   |

Extra columns the spreadsheet carries (`Quote Manager`, `Created By`,
`Assignees`, `QA`, `CS`, `SKU`, `Print By`, `Cert Type`, etc.) are ignored
by the portal today. If you want them, add to the schema and they'll flow
through.

## Coworker prompt — drop-in

Add this to the end of the existing coworker job's prompt. Replace the URL
and token placeholders.

> After saving the xlsx, parse each sheet and POST the rows to the WB Blends
> portal so the admin Tickets page picks up today's data.
>
> Endpoint: `https://<portal>/api/tickets/sync`
> Auth header: `Authorization: Bearer <TICKETS_SYNC_TOKEN>`
>
> For each sheet, headers are on row 4 (1-indexed). Skip the title rows
> above. For each data row, build a JSON object with these keys (strings,
> empty string when missing):
>
> ```
> { tab, id, version, name, productType, customer, salesperson, status,
>   openDate, dueDate }
> ```
>
> Map `Product Type` → `productType`, `V1 Due Date` (FPS) → `dueDate`,
> everything else uses the obvious column. Use the sheet name as `tab`.
> Skip rows where `ID` is empty.
>
> POST a single request: `{ tickets: [...all rows from all sheets...] }`.
> Expect 200 with `{ ok: true, inserted, updated, softDeleted, total }`.
> If you get a non-200, log the response and abort — don't retry, the
> portal owns idempotency.

## Local dev

There's a one-off parser at `tmp-sync-from-xlsx.mjs` (gitignored) that does
the parse-and-POST locally. Useful for testing the endpoint against a real
spreadsheet:

```
node tmp-sync-from-xlsx.mjs
```
