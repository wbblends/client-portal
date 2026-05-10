"use client";

import { useRef, useState } from "react";
import { Paperclip, Send, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Pending = {
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageComposer({
  conversationId,
  placeholder,
}: {
  conversationId: string;
  placeholder: string;
}) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: Pending[] = [];
      for (const file of Array.from(fileList)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Upload failed (${res.status})`);
        }
        const data = (await res.json()) as Pending;
        uploaded.push(data);
      }
      setAttachments(prev => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    const trimmed = body.trim();
    if (!trimmed && attachments.length === 0) return;
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmed, attachments }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Send failed (${res.status})`);
      }
      setBody("");
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  function autosize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  return (
    <div className="border-t border-border bg-card px-3 sm:px-4 py-3">
      {error && (
        <div className="mb-2 text-xs text-danger">{error}</div>
      )}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="max-w-[160px] truncate">{a.fileName}</span>
              <span className="text-muted-soft">{formatBytes(a.size)}</span>
              <button
                type="button"
                onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                className="text-muted hover:text-foreground"
                aria-label={`Remove ${a.fileName}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "shrink-0 grid h-10 w-10 place-items-center rounded-lg",
            "text-muted hover:bg-accent hover:text-foreground transition-colors",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
          title="Attach file"
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => {
            uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <textarea
          ref={textareaRef}
          rows={1}
          value={body}
          placeholder={placeholder}
          onChange={e => {
            setBody(e.target.value);
            autosize(e.target);
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className={cn(
            "flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm leading-5",
            "min-h-10 max-h-48",
            "placeholder:text-muted-soft",
            "focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors",
          )}
        />
        <Button
          type="button"
          onClick={send}
          disabled={sending || (!body.trim() && attachments.length === 0)}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
      {uploading && (
        <div className="mt-1 text-xs text-muted">Uploading…</div>
      )}
    </div>
  );
}
