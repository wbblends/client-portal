"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteNodeAction } from "@/lib/data/documents-actions";

type Props = {
  customerId: string;
  nodeId: string;
  nodeName: string;
  /** "Folder" cascades to children, so the confirm copy needs to say so. */
  kind: "folder" | "file";
};

/** Small inline delete affordance used on persisted document/folder rows.
 *  Two-step: click once to enter "confirm" state, click again to actually
 *  delete. Avoids a modal for what is otherwise a single-row destructive
 *  action. Folders include a child-count warning in the confirm tooltip. */
export function DocumentsDeleteButton({ customerId, nodeId, nodeName, kind }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function trigger(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      // Auto-cancel after a short window so the row doesn't stay in the
      // "armed" state forever if the user wanders off.
      window.setTimeout(() => setConfirming(false), 4000);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteNodeAction(customerId, nodeId);
      if (!res.ok) {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={trigger}
      disabled={pending}
      title={
        error ??
        (confirming
          ? kind === "folder"
            ? `Click again to delete "${nodeName}" and everything inside it`
            : `Click again to delete "${nodeName}"`
          : `Delete ${nodeName}`)
      }
      className={
        "inline-flex items-center gap-1 shrink-0 rounded-md border px-2 min-h-11 sm:min-h-0 sm:py-1.5 text-xs font-medium transition-colors " +
        (confirming
          ? "border-danger bg-danger-soft text-danger hover:bg-danger/10"
          : "border-border text-muted hover:border-border-strong hover:bg-accent hover:text-foreground")
      }
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{confirming ? "Confirm" : "Delete"}</span>
    </button>
  );
}
