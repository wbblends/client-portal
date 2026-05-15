/**
 * Orders Portal row store. DB-backed so edits made by one admin show up for
 * every other portal user on their next poll. Mirrors the OrdersPortalRow
 * shape used by the spreadsheet UI.
 *
 * On the first read against an empty table we seed-import
 * `ORDERS_PORTAL_SEED` so existing environments don't come up blank. After
 * that the DB is the source of truth — the seed is reachable again only via
 * the explicit reset endpoint.
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { ensureDb } from "@/lib/db";
import {
  ORDERS_PORTAL_SEED,
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

// `maybeSeed` runs a SELECT COUNT(*) on every read to handle the first-boot
// "table is empty, copy in the seed" case. Once the table is non-empty for
// this process, that check is wasted work — cache the verdict.
let seedChecked = false;

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

async function maybeSeed(): Promise<void> {
  if (seedChecked) return;
  const client = await ensureDb();
  const { rows } = await client.execute("SELECT COUNT(*) AS n FROM orders_portal_rows");
  if ((rows[0]?.n as number) > 0) {
    seedChecked = true;
    return;
  }
  for (let i = 0; i < ORDERS_PORTAL_SEED.length; i++) {
    const r = ORDERS_PORTAL_SEED[i];
    await client.execute({
      sql: `INSERT INTO orders_portal_rows
              (id, customer, rep, cs, tier, projection, months_json, forecasts_json, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.id,
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
  seedChecked = true;
}

async function _listOrdersRows(): Promise<DbOrdersRow[]> {
  await maybeSeed();
  const client = await ensureDb();
  const { rows } = await client.execute(
    `SELECT id, customer, rep, cs, tier, projection, months_json, forecasts_json, position
       FROM orders_portal_rows
       ORDER BY position ASC, id ASC`,
  );
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
// view.
export const listOrdersRows = unstable_cache(
  _listOrdersRows,
  ["orders:listOrdersRows"],
  { tags: [ORDERS_CACHE_TAG], revalidate: ORDERS_CACHE_TTL_SECONDS },
);

export type CreateOrdersRowInput = {
  id?: string;
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
  const id =
    input.id?.trim() ||
    `r-new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const months = Array.isArray(input.months) && input.months.length === 12
    ? input.months
    : Array(12).fill(null);
  const forecasts = Array.isArray(input.forecasts) && input.forecasts.length === 12
    ? input.forecasts
    : Array(12).fill(null);
  // New rows go to the end by default.
  const { rows: maxRows } = await client.execute(
    "SELECT COALESCE(MAX(position), -1) AS p FROM orders_portal_rows",
  );
  const position =
    input.position ?? ((maxRows[0]?.p as number | undefined) ?? -1) + 1;

  await client.execute({
    sql: `INSERT INTO orders_portal_rows
            (id, customer, rep, cs, tier, projection, months_json, forecasts_json, position, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
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
  if (sets.length === 0) {
    // Nothing to change — just touch updated_at/updated_by.
    sets.push("updated_at = CURRENT_TIMESTAMP");
  } else {
    sets.push("updated_at = CURRENT_TIMESTAMP");
  }
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

/** Replace the table contents with ORDERS_PORTAL_SEED. */
export async function resetOrdersRows(): Promise<DbOrdersRow[]> {
  const client = await ensureDb();
  await client.execute("DELETE FROM orders_portal_rows");
  // Reset clears `seedChecked` so the next read repopulates from the seed.
  seedChecked = false;
  await maybeSeed();
  revalidateOrdersCache();
  return listOrdersRows();
}

/**
 * Fold a new order into the grid. If the customer already has a row, bump
 * the target month; otherwise insert a fresh row. Mirrors the behavior the
 * old client-side handler used to do against localStorage.
 */
export async function applyOrderToRows(args: {
  customer: string;
  rep: string;
  cs: string;
  revenue: number;
  createdAt: string;
  updatedBy: string;
}): Promise<{ row: DbOrdersRow; created: boolean }> {
  await maybeSeed();
  const client = await ensureDb();
  const monthIdx = new Date(args.createdAt).getMonth();
  const customerKey = args.customer.trim().toLowerCase();

  const { rows: existingRows } = await client.execute(
    `SELECT id, customer, rep, cs, tier, projection, months_json, forecasts_json, position
       FROM orders_portal_rows
       ORDER BY position ASC, id ASC`,
  );
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
