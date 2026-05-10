import Link from "next/link";
import { ChevronRight, Download, Folder, FileText, FileSpreadsheet, Image as ImageIcon, FolderOpen } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getDocuments, getChildren, getBreadcrumb, findNode } from "@/lib/data/documents";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { formatDate, cn } from "@/lib/utils";
import type { DocNode } from "@/lib/data/types";

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

export default async function DocumentsPage(props: PageProps<"/documents">) {
  const user = await requireSession();
  const sp = await props.searchParams;
  const folderId = typeof sp.folder === "string" ? sp.folder : null;

  const tree = await getDocuments(user.customerId);
  const current = folderId ? findNode(tree, folderId) ?? null : null;
  const items = getChildren(tree, folderId);
  const crumbs = getBreadcrumb(tree, folderId);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-display text-[26px] sm:text-[34px] leading-[1.1] tracking-tight text-foreground">
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
            {items.length === 0
              ? "This folder is empty."
              : `${items.length} item${items.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {items.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-border">
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
