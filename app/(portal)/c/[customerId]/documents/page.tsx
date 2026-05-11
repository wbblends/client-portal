import Link from "next/link";
import { ChevronRight, Folder, FileText, FileSpreadsheet, Image as ImageIcon, FolderOpen, Eye, Pencil } from "lucide-react";
import { requireCustomerAccess } from "@/lib/auth";
import {
  getDocuments,
  getChildren,
  getBreadcrumb,
  findNode,
  isPersistedNode,
} from "@/lib/data/documents";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentsEditorControls } from "@/components/portal/documents-editor-controls";
import { DocumentsDeleteButton } from "@/components/portal/documents-delete-button";
import { formatDate, cn } from "@/lib/utils";
import type { DocNode } from "@/lib/data/types";
import { FilterBar } from "@/components/filters/filter-bar";
import { readEnum, readSort, readString } from "@/lib/filters/url-state";
import { applyEnumEquals, applySort, applyTextSearch } from "@/lib/filters/apply";

type DocSortColumn = "name" | "kind" | "type" | "size" | "modified";
const DOC_SORT_COLUMNS: readonly DocSortColumn[] = ["name", "kind", "type", "size", "modified"] as const;
const DOC_KINDS = ["folder", "file"] as const;
const DOC_FILE_TYPES = ["pdf", "xlsx", "docx", "csv", "png", "jpg", "txt"] as const;

export const metadata = { title: "Documents — WB Blends" };

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

export default async function DocumentsPage(props: PageProps<"/c/[customerId]/documents">) {
  const { customerId } = await props.params;
  const { customer, permission } = await requireCustomerAccess(customerId);
  const isEditor = permission === "editor";
  const sp = await props.searchParams;
  const folderId = typeof sp.folder === "string" ? sp.folder : null;

  const tree = await getDocuments(customer.id);
  const current = folderId ? findNode(tree, folderId) ?? null : null;
  const allItems = getChildren(tree, folderId);
  const crumbs = getBreadcrumb(tree, folderId);

  const base = `/c/${customer.id}/documents`;

  // Folder navigation lives in `?folder=` and is preserved across filter changes.
  const query = readString(sp, "q");
  const kind = readEnum(sp, "kind", DOC_KINDS);
  const fileType = readEnum(sp, "type", DOC_FILE_TYPES);
  const sort = readSort<DocSortColumn>(sp, DOC_SORT_COLUMNS, { column: "name", direction: "asc" });

  let items = applyTextSearch(allItems, query, [n => n.name]);
  items = applyEnumEquals(items, kind, n => n.kind);
  if (fileType) {
    items = items.filter(n => n.kind === "file" && n.fileType === fileType);
  }
  // Always keep folders first, then apply the user's sort within each group so
  // file-type/size sorts don't bury subfolders below the file list.
  items = applySort(
    items,
    n => {
      switch (sort.column) {
        case "name":
          return n.name.toLowerCase();
        case "kind":
          return n.kind;
        case "type":
          return n.kind === "file" ? n.fileType ?? "" : null;
        case "size":
          return n.kind === "file" ? n.size ?? 0 : null;
        case "modified":
          return n.modified ?? null;
      }
    },
    sort.direction,
  );
  items = [...items].sort((a, b) => {
    if (a.kind === b.kind) return 0;
    return a.kind === "folder" ? -1 : 1;
  });

  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{customer.name}</p>
          <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
            Documents
          </h1>
          <p className="mt-1 text-sm text-muted">
            Finished Product Specs, COAs, certifications, and shared files between your team and
            ours. We email you whenever something new is uploaded.
          </p>
        </div>
        <Badge tone={isEditor ? "info" : "neutral"} className="shrink-0">
          {isEditor ? (
            <>
              <Pencil className="h-3 w-3" /> Editor
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" /> Viewer
            </>
          )}
        </Badge>
      </div>

      {isEditor && (
        <DocumentsEditorControls customerId={customer.id} currentFolderId={folderId} />
      )}

      {/* Breadcrumb — wraps on narrow screens so deep folder paths stay legible. */}
      <nav className="flex items-center gap-1 text-sm flex-wrap">
        <Link
          href={base}
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
              href={`${base}?folder=${c.id}`}
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
            {allItems.length === 0
              ? "This folder is empty."
              : items.length === allItems.length
                ? `${items.length} item${items.length === 1 ? "" : "s"}`
                : `Showing ${items.length} of ${allItems.length} items.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-0">
          <div className="px-4 sm:px-5">
            <FilterBar
              search={{ param: "q", placeholder: "Search file or folder…" }}
              selects={[
                {
                  kind: "select",
                  param: "kind",
                  label: "Kind",
                  options: [
                    { value: "", label: "Files & folders" },
                    { value: "folder", label: "Folders only" },
                    { value: "file", label: "Files only" },
                  ],
                },
                {
                  kind: "select",
                  param: "type",
                  label: "Type",
                  options: [
                    { value: "", label: "Any type" },
                    ...DOC_FILE_TYPES.map(t => ({ value: t, label: t.toUpperCase() })),
                  ],
                },
                {
                  kind: "select",
                  param: "sort",
                  label: "Sort",
                  options: [
                    { value: "", label: "Name" },
                    { value: "modified", label: "Modified" },
                    { value: "size", label: "Size" },
                    { value: "type", label: "Type" },
                  ],
                },
                {
                  kind: "select",
                  param: "dir",
                  label: "Order",
                  options: [
                    { value: "", label: "Asc" },
                    { value: "desc", label: "Desc" },
                  ],
                },
              ]}
            />
          </div>
          {allItems.length === 0 ? (
            <EmptyState isEditor={isEditor} />
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">
              No items match the current filters.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map(item => {
                const Icon = fileIcon(item);
                const persisted = isPersistedNode(item);
                const showDelete = isEditor && persisted;
                return (
                  <li key={item.id}>
                    {item.kind === "folder" ? (
                      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 min-h-14 sm:min-h-12 hover:bg-accent/40 active:bg-accent transition-colors">
                        <Link
                          href={`${base}?folder=${item.id}`}
                          className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0"
                        >
                          <Icon className="h-5 w-5 shrink-0 text-primary" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground truncate">{item.name}</div>
                            <div className="text-xs text-muted">
                              Folder
                              {persisted && " · Added by your team"}
                            </div>
                          </div>
                        </Link>
                        {showDelete ? (
                          <DocumentsDeleteButton
                            customerId={customer.id}
                            nodeId={item.id}
                            nodeName={item.name}
                            kind="folder"
                          />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-soft" />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 min-h-14 sm:min-h-12 hover:bg-accent/40 active:bg-accent transition-colors">
                        <Icon className="h-5 w-5 shrink-0 text-foreground-soft" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">{item.name}</div>
                          <div className="text-xs text-muted truncate">
                            {item.fileType?.toUpperCase()} · {formatBytes(item.size)}
                            {item.modified && ` · Modified ${formatDate(item.modified, "short")}`}
                          </div>
                        </div>
                        {/* Download is not built yet — show a small "Soon"
                            badge instead of a dead disabled button so it
                            reads as "feature pending" rather than broken. */}
                        <span
                          className="hidden sm:inline-flex items-center gap-1 shrink-0 rounded-md border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-soft"
                          aria-label="Download coming soon"
                        >
                          Soon
                        </span>
                        {showDelete && (
                          <DocumentsDeleteButton
                            customerId={customer.id}
                            nodeId={item.id}
                            nodeName={item.name}
                            kind="file"
                          />
                        )}
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

function EmptyState({ isEditor }: { isEditor: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-accent">
        <FolderOpen className="h-6 w-6 text-muted" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">Nothing Here Yet</p>
      <p className="mt-1 text-sm text-muted max-w-xs">
        {isEditor
          ? "Use the buttons above to add a folder or document to this area."
          : "Files shared by your account team will land here. You’ll get an email whenever something new is uploaded."}
      </p>
    </div>
  );
}
