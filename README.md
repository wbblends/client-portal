# WB Blends Portal

Customer-facing portal for WB Blends — orders, invoices, documents, contacts —
plus an admin marketing dashboard. Next.js 16 (App Router), React 19,
Tailwind v4, Recharts.

Built with a swappable data layer: today the portal runs on deterministic
mock data so the UI is fully clickable; tomorrow the same pages will be wired
to Acumatica + the proprietary CRM by replacing the loaders in `lib/data/*`
without touching pages or components.

## Getting started

```powershell
npm install
npm run dev
```

Open <http://localhost:3000>. Demo credentials: `dsimmons` / `test`.

## Scripts

- `npm run dev` — local dev server with hot reload
- `npm run build` — production build (uses webpack, not Turbopack — see `package.json`)
- `npm run start` — serve the production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`

## Layout

```
app/
  (portal)/                  authenticated routes (sidebar layout)
    c/[customerId]/          per-customer pages: overview, documents, invoices, quality, contact
    dashboards/[slug]/       cross-customer dashboards (registry-driven)
    admin/users/             admin: manage seeded users
  api/                       API routes (auth, etc.)
  login/                     unauthenticated login page
components/
  dashboard/                 chart + KPI building blocks
  dashboards/                full dashboard renderers (one per registry entry)
  portal/                    sidebar, mobile nav, command palette, user menu
  ui/                        primitives (button, card, input, etc.)
lib/
  auth.ts                    HMAC-signed session cookies + route guards
  customers/registry.ts      customer slugs + display names (single source of truth)
  data/                      swappable data layer — replace these with API calls
  dashboards/registry.ts     dashboards available per role
  marketing/                 HubSpot + Google Ads + LinkedIn loaders
  users/                     seeded users + bcrypt hashing
public/
  avatars/                   user avatar files (filename matches username)
  brand/                     logo + brand assets
```

## Adding a customer

Edit `lib/customers/registry.ts`. Pages under `/c/<id>/...` will start
working immediately and pull mock data deterministically seeded on the id.

## Adding a user

Edit `lib/users/users.json` (and reload). Passwords are stored as bcrypt
hashes; use the existing entries as a template. For role-based access, see
the `role` and `dashboards` fields.

## Adding a dashboard

Add an entry to `lib/dashboards/registry.ts`, then either rely on the
generic `<PlaceholderDashboard>` or add a renderer in `components/dashboards/`
and a `case` in `app/(portal)/dashboards/[slug]/page.tsx`.

## Environment

See `.env.example`. The portal runs without any env vars set — every external
integration falls back to placeholder data so the UI stays demo-able.

## Deploy

See `SHIP.md` for the full Vercel walkthrough.
