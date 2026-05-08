import type { DocNode } from "./types";

/**
 * Mock document tree. Future: replace with a SharePoint / S3 / proprietary DAM
 * listing. Two empty placeholder folders requested for the starter account.
 */
export async function getDocuments(_customerId: string): Promise<DocNode[]> {
  return [
    { id: "f1", parentId: null, name: "Ashwagandha Document Package", kind: "folder" },
    { id: "f2", parentId: null, name: "Greens Document Package", kind: "folder" },
  ];
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
