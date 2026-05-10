/**
 * Documents tree — Finished Product Specs (FPS), COAs, certifications, etc.
 *
 * Two layers stitched together at read time:
 *  - Seeded mock tree (deterministic per customerId) — always present so the
 *    portal never looks empty during the placeholder-data phase. Node ids are
 *    prefixed `f-` (folders) and `d-` (docs); these are read-only.
 *  - Editor-added persisted nodes from `customer_documents` (DB) — node ids
 *    are prefixed `p-`. Use `isPersistedNode(node)` to decide whether a UI
 *    affordance (delete, etc.) should be shown.
 *
 * Future: replace the seeded layer with a SharePoint / S3 / proprietary DAM
 * listing keyed on customerId. The persisted layer can either fold into that
 * system or keep living in our DB as customer-side annotations.
 */
import { ensureDb } from "@/lib/db";
import { hashString, seededRng } from "@/lib/utils";
import type { DocNode } from "./types";

export const PERSISTED_ID_PREFIX = "p-";

export function isPersistedNode(node: DocNode): boolean {
  return node.id.startsWith(PERSISTED_ID_PREFIX);
}

export async function getDocuments(customerId: string): Promise<DocNode[]> {
  const seeded = generateSeededTree(customerId);
  const persisted = await loadPersistedNodes(customerId);
  return [...seeded, ...persisted];
}

function generateSeededTree(customerId: string): DocNode[] {
  const rng = seededRng(hashString(customerId) ^ 0x4d_0c_55);
  const tree: DocNode[] = [];

  // 2–4 product packages per customer.
  const packageCount = 2 + Math.floor(rng() * 3);
  const packageNames = pick(PRODUCT_PACKAGES, packageCount, rng);

  for (const productName of packageNames) {
    const folderId = `f-${slug(productName)}`;
    tree.push({
      id: folderId,
      parentId: null,
      name: `${productName} Document Package`,
      kind: "folder",
    });

    // 3–6 docs per package.
    const docCount = 3 + Math.floor(rng() * 4);
    const docTemplates = pick(DOC_TEMPLATES, docCount, rng);
    for (const t of docTemplates) {
      tree.push({
        id: `d-${slug(productName)}-${slug(t.name)}`,
        parentId: folderId,
        name: t.name.replace("{product}", productName),
        kind: "file",
        fileType: t.fileType,
        size: Math.floor(t.minKb + rng() * (t.maxKb - t.minKb)) * 1024,
        modified: monthsAgo(rng() * 11),
      });
    }
  }

  // One shared customer-level folder.
  if (rng() > 0.3) {
    tree.push({
      id: "f-shared",
      parentId: null,
      name: "Shared Files",
      kind: "folder",
    });
    tree.push({
      id: "d-msa",
      parentId: "f-shared",
      name: "Master Supply Agreement.pdf",
      kind: "file",
      fileType: "pdf",
      size: Math.floor(420 + rng() * 200) * 1024,
      modified: monthsAgo(8 + rng() * 16),
    });
    tree.push({
      id: "d-pricing",
      parentId: "f-shared",
      name: "2026 Pricing Worksheet.xlsx",
      kind: "file",
      fileType: "xlsx",
      size: Math.floor(60 + rng() * 80) * 1024,
      modified: monthsAgo(rng() * 3),
    });
  }

  return tree;
}

const PRODUCT_PACKAGES = [
  "Ashwagandha",
  "Greens",
  "Mushroom Trio",
  "Rhodiola",
  "Turmeric",
  "L-Theanine",
  "Reishi",
  "Sleep Stack",
  "Pre-Workout",
  "Magnesium Glycinate",
  "Lion's Mane",
  "Beet Root",
];

const DOC_TEMPLATES: ReadonlyArray<{
  name: string;
  fileType: NonNullable<DocNode["fileType"]>;
  minKb: number;
  maxKb: number;
}> = [
  { name: "{product} - Finished Product Spec.pdf", fileType: "pdf", minKb: 280, maxKb: 720 },
  { name: "{product} - COA Lot 1234.pdf", fileType: "pdf", minKb: 180, maxKb: 360 },
  { name: "{product} - COA Lot 1188.pdf", fileType: "pdf", minKb: 180, maxKb: 360 },
  { name: "{product} - Heavy Metals Report.pdf", fileType: "pdf", minKb: 140, maxKb: 280 },
  { name: "{product} - Microbiological Report.pdf", fileType: "pdf", minKb: 140, maxKb: 280 },
  { name: "{product} - Allergen Statement.pdf", fileType: "pdf", minKb: 90, maxKb: 180 },
  { name: "{product} - Kosher Certificate.pdf", fileType: "pdf", minKb: 220, maxKb: 320 },
  { name: "{product} - Organic Certificate.pdf", fileType: "pdf", minKb: 220, maxKb: 320 },
  { name: "{product} - Stability Data.xlsx", fileType: "xlsx", minKb: 80, maxKb: 180 },
  { name: "{product} - Label Artwork.pdf", fileType: "pdf", minKb: 1200, maxKb: 4800 },
];

function pick<T>(items: readonly T[], n: number, rng: () => number): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function monthsAgo(m: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.round(m * 30));
  return d;
}

async function loadPersistedNodes(customerId: string): Promise<DocNode[]> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT id, parent_id, name, kind, file_type, size_bytes, created_at
            FROM customer_documents
           WHERE customer_id = ?`,
    args: [customerId],
  });
  return rows.map(r => {
    const node: DocNode = {
      id: r.id as string,
      parentId: (r.parent_id as string | null) ?? null,
      name: r.name as string,
      kind: r.kind as "folder" | "file",
    };
    if (r.file_type) node.fileType = r.file_type as DocNode["fileType"];
    if (r.size_bytes != null) node.size = r.size_bytes as number;
    if (r.created_at) node.modified = new Date(r.created_at as string);
    return node;
  });
}

/** Validates that a parentId (if non-null) refers to a folder belonging to
 *  the same customer — covers both seeded folders and persisted ones. */
async function assertValidParent(customerId: string, parentId: string | null): Promise<void> {
  if (parentId === null) return;
  const tree = await getDocuments(customerId);
  const parent = tree.find(n => n.id === parentId);
  if (!parent) throw new Error("Parent folder not found in this customer's document tree.");
  if (parent.kind !== "folder") throw new Error("Cannot create children inside a file.");
}

function newPersistedId(): string {
  // Short random suffix is enough — collisions inside a single customer are
  // already vanishingly unlikely, and the row PK enforces uniqueness anyway.
  return `${PERSISTED_ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createPersistedFolder(input: {
  customerId: string;
  parentId: string | null;
  name: string;
  createdBy: string;
}): Promise<DocNode> {
  const name = input.name.trim();
  if (!name) throw new Error("Folder name is required.");
  if (name.length > 120) throw new Error("Folder name is too long (max 120 chars).");
  await assertValidParent(input.customerId, input.parentId);
  const id = newPersistedId();
  const client = await ensureDb();
  await client.execute({
    sql: `INSERT INTO customer_documents
            (id, customer_id, parent_id, name, kind, created_by)
          VALUES (?, ?, ?, ?, 'folder', ?)`,
    args: [id, input.customerId, input.parentId, name, input.createdBy],
  });
  return { id, parentId: input.parentId, name, kind: "folder" };
}

const ALLOWED_FILE_TYPES = new Set<NonNullable<DocNode["fileType"]>>([
  "pdf",
  "xlsx",
  "docx",
  "csv",
  "png",
  "jpg",
  "txt",
]);

export async function createPersistedDocument(input: {
  customerId: string;
  parentId: string | null;
  name: string;
  fileType: NonNullable<DocNode["fileType"]>;
  sizeBytes?: number;
  createdBy: string;
}): Promise<DocNode> {
  const name = input.name.trim();
  if (!name) throw new Error("Document name is required.");
  if (name.length > 200) throw new Error("Document name is too long (max 200 chars).");
  if (!ALLOWED_FILE_TYPES.has(input.fileType)) {
    throw new Error("Unsupported file type.");
  }
  await assertValidParent(input.customerId, input.parentId);
  const id = newPersistedId();
  const client = await ensureDb();
  await client.execute({
    sql: `INSERT INTO customer_documents
            (id, customer_id, parent_id, name, kind, file_type, size_bytes, created_by)
          VALUES (?, ?, ?, ?, 'file', ?, ?, ?)`,
    args: [
      id,
      input.customerId,
      input.parentId,
      name,
      input.fileType,
      input.sizeBytes ?? null,
      input.createdBy,
    ],
  });
  const node: DocNode = {
    id,
    parentId: input.parentId,
    name,
    kind: "file",
    fileType: input.fileType,
    modified: new Date(),
  };
  if (input.sizeBytes != null) node.size = input.sizeBytes;
  return node;
}

/** Deletes a persisted node belonging to the given customer. Cascades to
 *  child rows via the table's FK ON DELETE CASCADE. Refuses to touch
 *  seeded-mock nodes (their ids don't carry the persisted prefix). */
export async function deletePersistedNode(input: {
  customerId: string;
  nodeId: string;
}): Promise<void> {
  if (!input.nodeId.startsWith(PERSISTED_ID_PREFIX)) {
    throw new Error("Cannot delete seeded mock entries.");
  }
  const client = await ensureDb();
  await client.execute({
    sql: `DELETE FROM customer_documents WHERE id = ? AND customer_id = ?`,
    args: [input.nodeId, input.customerId],
  });
}

export function getChildren(tree: DocNode[], parentId: string | null): DocNode[] {
  return tree
    .filter(n => n.parentId === parentId)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function findNode(tree: DocNode[], id: string): DocNode | undefined {
  return tree.find(n => n.id === id);
}

export function getBreadcrumb(tree: DocNode[], id: string | null): DocNode[] {
  const trail: DocNode[] = [];
  let current = id;
  while (current) {
    const n = findNode(tree, current);
    if (!n) break;
    trail.unshift(n);
    current = n.parentId;
  }
  return trail;
}
