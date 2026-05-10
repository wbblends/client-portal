import { applyPage, type Page, type PageOpts } from "@/lib/pagination";
import type { DocNode } from "./types";

/**
 * Mock document tree. Future: replace with a SharePoint / S3 / proprietary DAM
 * listing. Real APIs typically expose flat folder children with their own
 * paging — `getFolderContents` matches that shape so the swap is mechanical.
 */

async function loadTree(_customerId: string): Promise<DocNode[]> {
  return [
    { id: "f1", parentId: null, name: "Ashwagandha Document Package", kind: "folder" },
    { id: "f2", parentId: null, name: "Greens Document Package", kind: "folder" },
  ];
}

function sortChildren(a: DocNode, b: DocNode) {
  if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

export async function getFolderContents(
  customerId: string,
  folderId: string | null,
  opts: PageOpts = {},
): Promise<Page<DocNode>> {
  const tree = await loadTree(customerId);
  const children = tree.filter(n => n.parentId === folderId).sort(sortChildren);
  return applyPage(children, opts);
}

export async function getCurrentFolder(
  customerId: string,
  folderId: string | null,
): Promise<DocNode | null> {
  if (!folderId) return null;
  const tree = await loadTree(customerId);
  return tree.find(n => n.id === folderId) ?? null;
}

export async function getFolderBreadcrumb(
  customerId: string,
  folderId: string | null,
): Promise<DocNode[]> {
  if (!folderId) return [];
  const tree = await loadTree(customerId);
  const trail: DocNode[] = [];
  let current: string | null = folderId;
  while (current) {
    const node = tree.find(n => n.id === current);
    if (!node) break;
    trail.unshift(node);
    current = node.parentId;
  }
  return trail;
}
