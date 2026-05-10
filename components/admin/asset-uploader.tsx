"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  customerId: string;
  kind: "avatar" | "logo";
  label: string;
  currentUrl: string | null;
  shape: "circle" | "rect";
  onUploaded: () => void;
};

export function AssetUploader({ customerId, kind, label, currentUrl, shape, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setUploading(true);
    // Show local preview immediately for responsiveness.
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);

    try {
      const res = await fetch(`/api/admin/customers/${customerId}/assets`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        setPreviewUrl(currentUrl);
        URL.revokeObjectURL(localUrl);
        setUploading(false);
        return;
      }
      // Swap preview to the saved URL so it survives a refresh.
      setPreviewUrl(data.url);
      URL.revokeObjectURL(localUrl);
      onUploaded();
    } catch {
      setError("Could not reach the server.");
      setPreviewUrl(currentUrl);
      URL.revokeObjectURL(localUrl);
    } finally {
      setUploading(false);
    }
  }

  const sizeClass = shape === "circle" ? "h-20 w-20 rounded-full" : "h-20 w-32 rounded-lg";

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs font-medium text-foreground-soft">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        <div
          className={cn(
            "shrink-0 overflow-hidden bg-accent ring-1 ring-border grid place-items-center",
            sizeClass,
          )}
        >
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt={label}
              width={shape === "circle" ? 80 : 128}
              height={80}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-[11px] text-muted">No {kind}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              // Allow re-selecting the same file.
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : currentUrl ? "Replace" : "Upload"}
          </Button>
          <p className="mt-1.5 text-[11px] text-muted">PNG, JPG, WEBP, SVG, GIF · up to 5 MB</p>
          {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
