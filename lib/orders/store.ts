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
import { ensureDb } from "@/lib/db";
import {
  ORDERS_PORTAL_SEED,
  type OrdersPortalRow,
  type Tier,
} from "@/lib/data/orders-portal";

export type DbOrdersRow = OrdersPortalRow;

const EMPTY_MONTHS = "[null,null,null,null,null,null,null,null,null,null,null,null]";

function parseMonths(json: string): (number | null)[] {
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
}): DbOrdersRow {
  return {
    id: r.id,
    customer: r.customer ?? "",
    rep: r.rep ?? "",
    cs: r.cs ?? "",
    tier: (r.tier as Tier | "") ?? "",
    projection: Number(r.projection) || 0,
    months: parseMonths(r.months_json),
  };
}

async function maybeSeed(): Promise<void> {
  const client = await ensureDb();
  const { rows } = await client.execute("SELECT COUNT(*) AS n FROM orders_portal_rows");
  if ((rows[0]?.n as number) > 0) return;
  for (let i = 0; i < ORDERS_PORTAL_SEED.length; i++) {
    const r = ORDERS_PORTAL_SEED[i];
    await client.execute({
      sql: `INSERT INTO orders_portal_rows
              (id, customer, rep, cs, tier, projection, months_json, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.id,
        r.customer,
        r.rep,
        r.cs,
        r.tier,
        r.projection,
        JSON.stringify(r.months),
        i,
      ],
    });
  }
}

export async function listOrdersRows(): Promise<DbOrdersRow[]> {
  await maybeSeed();
  const client = await ensureDb();
  const { rows } = await client.execute(
    `SELECT id, customer, rep, cs, tier, projection, months_json, position
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
    position: number;
  }>).map(rowFromDb);
}

export type CreateOrdersRowInput = {
  id?: string;
  customer?: string;
  rep?: string;
  cs?: string;
  tier?: Tier | "";
  projection?: number;
  months?: (number | null)[];
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
  // New rows go to the end by default.
  const { rows: maxRows } = await client.execute(
    "SELECT COALESCE(MAX(position), -1) AS p FROM orders_portal_rows",
  );
  const position =
    input.position ?? ((maxRows[0]?.p as number | undefined) ?? -1) + 1;

  await client.execute({
    sql: `INSERT INTO orders_portal_rows
            (id, customer, rep, cs, tier, projection, months_json, position, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.customer ?? "",
      input.rep ?? "",
      input.cs ?? "",
      input.tier ?? "",
      Number(input.projection) || 0,
      JSON.stringify(months),
      position,
      updatedBy,
    ],
  });
  return {
    id,
    customer: input.customer ?? "",
    rep: input.rep ?? "",
    cs: input.cs ?? "",
    tier: (input.tier as Tier | "") ?? "",
    projection: Number(input.projection) || 0,
    months,
  };
}

export type PatchOrdersRowInput = {
  customer?: string;
  rep?: string;
  cs?: string;
  tier?: Tier | "";
  projection?: number;
  months?: (number | null)[];
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

  const { rows } = await client.execute({
    sql: `SELECT id, customer, rep, cs, tier, projection, months_json, position
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
}

/** Replace the table contents with ORDERS_PORTAL_SEED. */
export async function resetOrdersRows(): Promise<DbOrdersRow[]> {
  const client = await ensureDb();
  await client.execute("DELETE FROM orders_portal_rows");
  await maybeSeed();
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
    `SELECT id, customer, rep, cs, tier, projection, months_json, position
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
