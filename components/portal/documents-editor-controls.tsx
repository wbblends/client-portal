"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FolderPlus, FilePlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDocumentAction,
  createFolderAction,
  type ActionResult,
} from "@/lib/data/documents-actions";

type Props = {
  customerId: string;
  /** Current folder id (the one whose contents are being viewed). The new
   *  folder/document goes inside this. Null = root. */
  currentFolderId: string | null;
};

/**
 * Toolbar shown above the document list when the viewer has editor
 * permission. Two inline dialogs (no portal/dropdown library needed) for
 * "New folder" and "Add document". Server actions live in
 * `lib/data/documents-actions.ts` and re-check authorization.
 */
export function DocumentsEditorControls({ customerId, currentFolderId }: Props) {
  const [open, setOpen] = useState<null | "folder" | "document">(null);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen("folder")}
      >
        <FolderPlus className="h-4 w-4" />
        New folder
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => setOpen("document")}
      >
        <FilePlus className="h-4 w-4" />
        Add document
      </Button>

      {open === "folder" && (
        <NewFolderDialog
          customerId={customerId}
          parentId={currentFolderId}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "document" && (
        <AddDocumentDialog
          customerId={customerId}
          parentId={currentFolderId}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

// ─── Dialogs ───────────────────────────────────────────────────────────

function NewFolderDialog({
  customerId,
  parentId,
  onClose,
}: {
  customerId: string;
  parentId: string | null;
  onClose: () => void;
}) {
  const action = createFolderAction.bind(null, customerId);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <DialogShell title="New folder" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="parentId" value={parentId ?? ""} />
        <div className="space-y-1.5">
          <Label htmlFor="folder-name">Folder name</Label>
          <Input
            ref={inputRef}
            id="folder-name"
            name="name"
            placeholder="e.g. Q4 Test Reports"
            required
            maxLength={120}
            disabled={pending}
          />
        </div>
        <ErrorBanner state={state} />
        <DialogFooter pending={pending} onClose={onClose} submitLabel="Create folder" />
      </form>
    </DialogShell>
  );
}

function AddDocumentDialog({
  customerId,
  parentId,
  onClose,
}: {
  customerId: string;
  parentId: string | null;
  onClose: () => void;
}) {
  const action = addDocumentAction.bind(null, customerId);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <DialogShell title="Add document" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="parentId" value={parentId ?? ""} />
        <div className="space-y-1.5">
          <Label htmlFor="doc-name">Document name</Label>
          <Input
            ref={inputRef}
            id="doc-name"
            name="name"
            placeholder="e.g. Ashwagandha COA Lot 2210.pdf"
            required
            maxLength={200}
            disabled={pending}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="doc-type">File type</Label>
            <select
              id="doc-type"
              name="fileType"
              defaultValue="pdf"
              disabled={pending}
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm
                focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none
                disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              <option value="pdf">PDF</option>
              <option value="xlsx">XLSX</option>
              <option value="docx">DOCX</option>
              <option value="csv">CSV</option>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="txt">TXT</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-size">Size (bytes, optional)</Label>
            <Input
              id="doc-size"
              name="sizeBytes"
              type="number"
              min={0}
              step={1}
              placeholder="120000"
              disabled={pending}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted">
          File metadata only — actual upload storage will be wired up alongside the rest of the
          data layer. The download button stays a placeholder for now.
        </p>
        <ErrorBanner state={state} />
        <DialogFooter pending={pending} onClose={onClose} submitLabel="Add document" />
      </form>
    </DialogShell>
  );
}

// ─── Shared dialog chrome ──────────────────────────────────────────────

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Close on Escape for keyboard users.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="font-medium text-foreground">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function DialogFooter({
  pending,
  onClose,
  submitLabel,
}: {
  pending: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
      <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}

function ErrorBanner({ state }: { state: ActionResult | null }) {
  if (!state || state.ok) return null;
  return (
    <div className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
      {state.error}
    </div>
  );
}
