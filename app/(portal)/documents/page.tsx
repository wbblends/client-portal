import Link from "next/link";
import { ChevronRight, Download, Folder, FileText, FileSpreadsheet, Image as ImageIcon, FolderOpen } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getDocuments, getChildren, getBreadcrumb, findNode } from "@/lib/data/documents";
import { parseSearchParam, parseMultiParam } from "@/lib/filters";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { formatDate, cn } from "@/lib/utils";
import type { DocNode } from "@/lib/data/types";

export const metadata = { title: "Documents — WB Blends" };

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A → Z)" },
  { value: "name-desc", label: "Name (Z → A)" },
  { value: "modified-desc", label: "Modified (newest)" },
  { value: "modified-asc", label: "Modified (oldest)" },
  { value: "size-desc", label: "Size (largest)" },
  { value: "size-asc", label: "Size (smallest)" },
];

const TYPE_OPTIONS = [
  { value: "folder", label: "Folders" },
  { value: "pdf", label: "PDF" },
  { value: "xlsx", label: "Excel" },
  { value: "docx", label: "Word" },
  { value: "csv", label: "CSV" },
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "txt", label: "Text" },
];

function fileIcon(node: DocNode) {
  if (node.kind === "folder") return Folder;
  switch (node.fileType) {
    case "xlsx":
    case "csv":
      return FileSpreadsheet;
    case "png":
    case "jpg":
      return ImageIcon;
    default:
      return FileText;
  }
}

function formatBytes(b?: number): string {
  if (b == null) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function nodeMatchesType(node: DocNode, types: string[]): boolean {
  if (types.length === 0) return true;
  if (node.kind === "folder") return types.includes("folder");
  return !!(node.fileType && types.includes(node.fileType));
}

function sortNodes(nodes: DocNode[], sortToken: string): DocNode[] {
  const [field, dirRaw] = sortToken.split("-");
  const dir = dirRaw === "asc" ? 1 : -1;
  return [...nodes].sort((a, b) => {
    // Folders always cluster first — they navigate, files don't.
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    switch (field) {
      case "modified": {
        const ax = a.modified?.getTime() ?? 0;
        const bx = b.modified?.getTime() ?? 0;
        return (ax - bx) * dir;
      }
      case "size": {
        const ax = a.size ?? 0;
        const bx = b.size ?? 0;
        return (ax - bx) * dir;
      }
      case "name":
      default:
        return a.name.localeCompare(b.name) * dir;
    }
  });
}

export default async function DocumentsPage(props: PageProps<"/documents">) {
  const user = await requireSession();
  const sp = await props.searchParams;
  const folderId = typeof sp.folder === "string" ? sp.folder : null;

  const q = parseSearchParam(sp.q).toLowerCase();
  const types = parseMultiParam(sp.type);
  const sort = parseSearchParam(sp.sort) || "name-asc";

  const tree = await getDocuments(user.customerId);
  const current = folderId ? findNode(tree, folderId) ?? null : null;
  const allChildren = getChildren(tree, folderId);

  let items = allChildren;
  if (q) items = items.filter(n => n.name.toLowerCase().includes(q));
  items = items.filter(n => nodeMatchesType(n, types));
  items = sortNodes(items, sort);

  const crumbs = getBreadcrumb(tree, folderId);

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-display text-[34px] leading-[1.1] tracking-tight text-foreground">
          Documents
        </h1>
        <p className="mt-1 text-sm text-muted">
          Finished Product Specs, COAs, certifications, and shared files between your team and
          ours. We email you whenever something new is uploaded.
        </p>
      </div>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm">
        <Link
          href="/documents"
          className={cn(
            "rounded-md px-2 py-1 transition-colors",
            !folderId ? "bg-accent text-foreground" : "text-muted hover:text-foreground hover:bg-accent",
          )}
        >
          All Files
        </Link>
        {crumbs.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-soft" />
            <Link
              href={`/documents?folder=${c.id}`}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                i === crumbs.length - 1
                  ? "bg-accent text-foreground"
                  : "text-muted hover:text-foreground hover:bg-accent",
              )}
            >
              {c.name}
            </Link>
          </div>
        ))}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>{current ? current.name : "All Files"}</CardTitle>
          <CardDescription>
            {allChildren.length === 0
              ? "This folder is empty."
              : items.length === allChildren.length
                ? `${items.length} item${items.length === 1 ? "" : "s"}`
                : `${items.length} of ${allChildren.length} items`}
          </CardDescription>
        </CardHeader>
        {allChildren.length > 0 && (
          <CardContent>
            <FilterBar
              searchParam="q"
              searchPlaceholder="Search files…"
              filterGroups={[
                { param: "type", label: "Type", options: TYPE_OPTIONS },
              ]}
              sort={{ options: SORT_OPTIONS, defaultValue: "name-asc" }}
            />
          </CardContent>
        )}
        <CardContent className="px-0 pt-0">
          {allChildren.length === 0 ? (
            <EmptyState />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-12 text-center border-t border-border">
              <p className="text-sm font-medium text-foreground">No matching files</p>
              <p className="mt-1 text-sm text-muted max-w-sm">
                Try clearing a filter or broadening your search to see more results.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {items.map(item => {
                const Icon = fileIcon(item);
                return (
                  <li key={item.id}>
                    {item.kind === "folder" ? (
                      <Link
                        href={`/documents?folder=${item.id}`}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-accent/40 transition-colors"
                      >
                        <Icon className="h-5 w-5 text-primary" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground">{item.name}</div>
                          <div className="text-xs text-muted">Folder</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-soft" />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-4 px-5 py-3 hover:bg-accent/40 transition-colors">
                        <Icon className="h-5 w-5 text-foreground-soft" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">{item.name}</div>
                          <div className="text-xs text-muted">
                            {item.fileType?.toUpperCase()} · {formatBytes(item.size)}
                            {item.modified && ` · Modified ${formatDate(item.modified, "short")}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground-soft hover:border-border-strong hover:bg-accent transition-colors"
                          title={`Download ${item.name}`}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-accent">
        <FolderOpen className="h-6 w-6 text-muted" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">Nothing Here Yet</p>
      <p className="mt-1 text-sm text-muted max-w-xs">
        Files shared by your account team will land here. You&apos;ll get an email whenever
        something new is uploaded.
      </p>
    </div>
  );
}
