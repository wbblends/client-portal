/**
 * Daily open-PO backlog store. Holds the manually-entered "as of today"
 * open-purchase-order totals shown on the Orders Backlog dashboard. One row
 * per calendar date — re-saving a date overwrites it — so the latest row is
 * the current figure.
 */
import { ensureDb } from "@/lib/db";

export type OpenPoEntry = {
  /** Calendar date of the snapshot, YYYY-MM-DD. */
  date: string;
  /** Open-PO total in dollars. */
  amount: number;
  updatedBy: string | null;
  updatedAt: string;
};

function rowToEntry(r: {
  entry_date: string;
  amount: number;
  updated_by: string | null;
  updated_at: string;
}): OpenPoEntry {
  return {
    date: r.entry_date,
    amount: Number(r.amount) || 0,
    updatedBy: r.updated_by ?? null,
    updatedAt: r.updated_at,
  };
}

/** Most recent entries first. */
export async function listOpenPoEntries(limit = 14): Promise<OpenPoEntry[]> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT entry_date, amount, updated_by, updated_at
            FROM open_po_daily
            ORDER BY entry_date DESC
            LIMIT ?`,
    args: [limit],
  });
  return (rows as unknown as Array<{
    entry_date: string;
    amount: number;
    updated_by: string | null;
    updated_at: string;
  }>).map(rowToEntry);
}

/** Insert or overwrite the entry for a given date. */
export async function recordOpenPoEntry(input: {
  date: string;
  amount: number;
  updatedBy: string;
}): Promise<OpenPoEntry> {
  const client = await ensureDb();
  await client.execute({
    sql: `INSERT INTO open_po_daily (entry_date, amount, updated_by, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(entry_date) DO UPDATE SET
            amount = excluded.amount,
            updated_by = excluded.updated_by,
            updated_at = CURRENT_TIMESTAMP`,
    args: [input.date, input.amount, input.updatedBy],
  });
  const { rows } = await client.execute({
    sql: `SELECT entry_date, amount, updated_by, updated_at
            FROM open_po_daily WHERE entry_date = ?`,
    args: [input.date],
  });
  return rowToEntry(
    rows[0] as unknown as {
      entry_date: string;
      amount: number;
      updated_by: string | null;
      updated_at: string;
    },
  );
}
