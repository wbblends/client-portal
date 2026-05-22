/**
 * Orders Portal row store. DB-backed so edits made by one admin show up for
 * every other portal user on their next poll. Mirrors the OrdersPortalRow
 * shape used by the spreadsheet UI.
 *
 * Rows are partitioned by calendar `year` — the grid shows one year at a time
 * behind a year tab. On the first read of a year against an empty partition
 * we seed-import that year's snapshot (`ordersPortalSeedForYear`) so existing
 * environments don't come up blank. After that the DB is the source of truth;
 * the seed is reachable again only via the explicit reset endpoint.
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { ensureDb } from "@/lib/db";
import {
  ordersPortalSeedForYear,
  PO_YEARS,
  CURRENT_PO_YEAR,
  type OrdersPortalRow,
  type Tier,
} from "@/lib/data/orders-portal";

export type DbOrdersRow = OrdersPortalRow;

const ORDERS_CACHE_TAG = "orders:rows";
const ORDERS_CACHE_TTL_SECONDS = 60;

export function revalidateOrdersCache(): void {
  // Next 16 requires a profile arg; { expire: 0 } means "expire immediately".
  revalidateTag(ORDERS_CACHE_TAG, { expire: 0 });
}

// `maybeSeed` runs a SELECT COUNT(*) per year on every read to handle the
// first-boot "this year's partition is empty, copy in the seed" case. Once a
// year is non-empty for this process, that check is wasted work — remember
// which years we've already settled.
const seededYears = new Set<number>();

function parseMonths(json: string | null | undefined): (number | null)[] {
  if (!json) return Array(12).fill(null);
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length === 12) {
      return parsed.map(v =>
        v === null || v === undefined || !Number.isFinite(Number(v))
          ? null
          : Number(v),
      );
    }
  } catch {
    // fall through
  }
  return Array(12).fill(null);
}

function rowFromDb(r: {
  id: string;
  customer: string;
  rep: string;
  cs: string;
  tier: string;
  projection: number;
  months_json: string;
  forecasts_json?: string | null;
}): DbOrdersRow {
  return {
    id: r.id,
    customer: r.customer ?? "",
    rep: r.rep ?? "",
    cs: r.cs ?? "",
    tier: (r.tier as Tier | "") ?? "",
    projection: Number(r.projection) || 0,
    months: parseMonths(r.months_json),
    forecasts: parseMonths(r.forecasts_json ?? null),
  };
}

/** Seed a single year's partition if it is still empty. */
async function maybeSeedYear(year: number): Promise<void> {
  if (seededYears.has(year)) return;
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: "SELECT COUNT(*) AS n FROM orders_portal_rows WHERE year = ?",
    args: [year],
  });
  if ((rows[0]?.n as number) > 0) {
    seededYears.add(year);
    return;
  }
  const seed = ordersPortalSeedForYear(year);
  for (let i = 0; i < seed.length; i++) {
    const r = seed[i];
    await client.execute({
      sql: `INSERT INTO orders_portal_rows
              (id, year, customer, rep, cs, tier, projection, months_json, forecasts_json, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.id,
        year,
        r.customer,
        r.rep,
        r.cs,
        r.tier,
        r.projection,
        JSON.stringify(r.months),
        JSON.stringify(r.forecasts),
        i,
      ],
    });
  }
  seededYears.add(year);
}

/** Seed every tracked year that is still empty. */
async function maybeSeed(): Promise<void> {
  for (const year of PO_YEARS) await maybeSeedYear(year);
}

async function _listOrdersRows(year: number): Promise<DbOrdersRow[]> {
  await maybeSeed();
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT id, customer, rep, cs, tier, projection, months_json, forecasts_json, position
            FROM orders_portal_rows
           WHERE year = ?
           ORDER BY position ASC, id ASC`,
    args: [year],
  });
  return (rows as unknown as Array<{
    id: string;
    customer: string;
    rep: string;
    cs: string;
    tier: string;
    projection: number;
    months_json: string;
    forecasts_json: string | null;
    position: number;
  }>).map(rowFromDb);
}

// Short TTL — the orders portal is the most edit-heavy surface and admins
// expect their save to show up on the next render. revalidateOrdersCache() is
// called from every mutation path below to bust the cache immediately so the
// TTL is only relevant for cross-user staleness, not the editing admin's own
// view. The `year` argument is part of the cache key, so each year caches
// independently.
const _listOrdersRowsCached = unstable_cache(
  _listOrdersRows,
  ["orders:listOrdersRows"],
  { tags: [ORDERS_CACHE_TAG], revalidate: ORDERS_CACHE_TTL_SECONDS },
);

export function listOrdersRows(
  year: number = CURRENT_PO_YEAR,
): Promise<DbOrdersRow[]> {
  return _listOrdersRowsCached(year);
}

export type CreateOrdersRowInput = {
  id?: string;
  year?: number;
  customer?: string;
  rep?: string;
  cs?: string;
  tier?: Tier | "";
  projection?: number;
  months?: (number | null)[];
  forecasts?: (number | null)[];
  position?: number;
};

export async function createOrdersRow(
  input: CreateOrdersRowInput,
  updatedBy: string,
): Promise<DbOrdersRow> {
  await maybeSeed();
  const client = await ensureDb();
  const year = input.year ?? CURRENT_PO_YEAR;
  const id =
    input.id?.trim() ||
    `r-new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const months = Array.isArray(input.months) && input.months.length === 12
    ? input.months
    : Array(12).fill(null);
  const forecasts = Array.isArray(input.forecasts) && input.forecasts.length === 12
    ? input.forecasts
    : Array(12).fill(null);
  // New rows go to the end of their year's partition by default.
  const { rows: maxRows } = await client.execute({
    sql: "SELECT COALESCE(MAX(position), -1) AS p FROM orders_portal_rows WHERE year = ?",
    args: [year],
  });
  const position =
    input.position ?? ((maxRows[0]?.p as number | undefined) ?? -1) + 1;

  await client.execute({
    sql: `INSERT INTO orders_portal_rows
            (id, year, customer, rep, cs, tier, projection, months_json, forecasts_json, position, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      year,
      input.customer ?? "",
      input.rep ?? "",
      input.cs ?? "",
      input.tier ?? "",
      Number(input.projection) || 0,
      JSON.stringify(months),
      JSON.stringify(forecasts),
      position,
      updatedBy,
    ],
  });
  revalidateOrdersCache();
  return {
    id,
    customer: input.customer ?? "",
    rep: input.rep ?? "",
    cs: input.cs ?? "",
    tier: (input.tier as Tier | "") ?? "",
    projection: Number(input.projection) || 0,
    months,
    forecasts,
  };
}

export type PatchOrdersRowInput = {
  customer?: string;
  rep?: string;
  cs?: string;
  tier?: Tier | "";
  projection?: number;
  months?: (number | null)[];
  forecasts?: (number | null)[];
};

export async function patchOrdersRow(
  id: string,
  patch: PatchOrdersRowInput,
  updatedBy: string,
): Promise<DbOrdersRow | null> {
  await maybeSeed();
  const client = await ensureDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.customer !== undefined) {
    sets.push("customer = ?");
    args.push(patch.customer);
  }
  if (patch.rep !== undefined) {
    sets.push("rep = ?");
    args.push(patch.rep);
  }
  if (patch.cs !== undefined) {
    sets.push("cs = ?");
    args.push(patch.cs);
  }
  if (patch.tier !== undefined) {
    sets.push("tier = ?");
    args.push(patch.tier);
  }
  if (patch.projection !== undefined) {
    sets.push("projection = ?");
    args.push(Number(patch.projection) || 0);
  }
  if (patch.months !== undefined) {
    const months =
      Array.isArray(patch.months) && patch.months.length === 12
        ? patch.months
        : Array(12).fill(null);
    sets.push("months_json = ?");
    args.push(JSON.stringify(months));
  }
  if (patch.forecasts !== undefined) {
    const forecasts =
      Array.isArray(patch.forecasts) && patch.forecasts.length === 12
        ? patch.forecasts
        : Array(12).fill(null);
    sets.push("forecasts_json = ?");
    args.push(JSON.stringify(forecasts));
  }
  // Always touch updated_at — even a no-op patch records who looked last.
  sets.push("updated_at = CURRENT_TIMESTAMP");
  sets.push("updated_by = ?");
  args.push(updatedBy);
  args.push(id);

  await client.execute({
    sql: `UPDATE orders_portal_rows SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
  revalidateOrdersCache();

  const { rows } = await client.execute({
    sql: `SELECT id, customer, rep, cs, tier, projection, months_json, forecasts_json, position
            FROM orders_portal_rows WHERE id = ?`,
    args: [id],
  });
  if (rows.length === 0) return null;
  return rowFromDb(
    rows[0] as unknown as {
      id: string;
      customer: string;
      rep: string;
      cs: string;
      tier: string;
      projection: number;
      months_json: string;
      forecasts_json: string | null;
    },
  );
}

export async function deleteOrdersRow(id: string): Promise<void> {
  await maybeSeed();
  const client = await ensureDb();
  await client.execute({
    sql: "DELETE FROM orders_portal_rows WHERE id = ?",
    args: [id],
  });
  revalidateOrdersCache();
}

/** Replace every year's partition with its seed snapshot. */
export async function resetOrdersRows(
  year: number = CURRENT_PO_YEAR,
): Promise<DbOrdersRow[]> {
  const client = await ensureDb();
  await client.execute("DELETE FROM orders_portal_rows");
  // Reset clears the seed memo so the next read repopulates every year.
  seededYears.clear();
  await maybeSeed();
  revalidateOrdersCache();
  return listOrdersRows(year);
}

/**
 * Fold a new order into the grid. If the customer already has a row in the
 * target year, bump that month; otherwise insert a fresh row. Mirrors the
 * behavior the old client-side handler used to do against localStorage.
 * Orders always land in the current PO year unless told otherwise.
 */
export async function applyOrderToRows(args: {
  customer: string;
  rep: string;
  cs: string;
  revenue: number;
  createdAt: string;
  updatedBy: string;
  year?: number;
}): Promise<{ row: DbOrdersRow; created: boolean }> {
  await maybeSeed();
  const client = await ensureDb();
  const year = args.year ?? CURRENT_PO_YEAR;
  const monthIdx = new Date(args.createdAt).getMonth();
  const customerKey = args.customer.trim().toLowerCase();

  const { rows: existingRows } = await client.execute({
    sql: `SELECT id, customer, rep, cs, tier, projection, months_json, forecasts_json, position
            FROM orders_portal_rows
           WHERE year = ?
           ORDER BY position ASC, id ASC`,
    args: [year],
  });
  const list = existingRows as unknown as Array<{
    id: string;
    customer: string;
    rep: string;
    cs: string;
    tier: string;
    projection: number;
    months_json: string;
    forecasts_json: string | null;
    position: number;
  }>;
  const match = list.find(
    r => (r.customer ?? "").trim().toLowerCase() === customerKey,
  );

  if (match) {
    const months = parseMonths(match.months_json);
    months[monthIdx] = (months[monthIdx] ?? 0) + args.revenue;
    const rep = match.rep || args.rep;
    const cs = match.cs || args.cs;
    const updated = await patchOrdersRow(
      match.id,
      { rep, cs, months },
      args.updatedBy,
    );
    return { row: updated!, created: false };
  }

  const months = Array(12).fill(null) as (number | null)[];
  months[monthIdx] = args.revenue;
  const created = await createOrdersRow(
    {
      year,
      customer: args.customer,
      rep: args.rep,
      cs: args.cs,
      tier: "",
      projection: args.revenue,
      months,
    },
    args.updatedBy,
  );
  return { row: created, created: true };
}
