/**
 * Documents tree — Finished Product Specs (FPS), COAs, certifications, etc.
 * Future: replace with a SharePoint / S3 / proprietary DAM listing keyed on
 * customerId.
 *
 * Mock generator deterministically produces a different package per
 * customerId so an admin switching customers sees distinct documents.
 */
import { hashString, seededRng } from "@/lib/utils";
import type { DocNode } from "./types";

export async function getDocuments(customerId: string): Promise<DocNode[]> {
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
