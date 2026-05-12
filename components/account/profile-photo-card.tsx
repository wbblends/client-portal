"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProfilePhotoCard({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  // Optimistic preview — replaces server avatarUrl until router.refresh() lands.
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = preview ?? avatarUrl;
  const initials = name
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
      setError("Pick a PNG, JPG, WebP, or GIF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("That image is over 8 MB — pick something smaller.");
      return;
    }
    let dataUrl: string;
    try {
      dataUrl = await resizeImageToDataUrl(file, 256, 0.85);
    } catch {
      setError("Couldn't read that image.");
      return;
    }
    if (dataUrl.length > 280_000) {
      setError("Couldn't compress that image small enough. Try a different one.");
      return;
    }
    setPreview(dataUrl);
    startTransition(async () => {
      const res = await fetch("/api/account/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't save that photo.");
        setPreview(null);
        return;
      }
      router.refresh();
    });
  }

  async function onRemove() {
    setError(null);
    if (!shown) return;
    setPreview(null);
    startTransition(async () => {
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't remove the photo.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0">
        {shown ? (
          <Image
            src={shown}
            alt={name}
            width={96}
            height={96}
            unoptimized={shown.startsWith("data:")}
            className={cn(
              "h-24 w-24 rounded-full object-cover ring-1 ring-border",
              pending && "opacity-70",
            )}
          />
        ) : (
          <div
            aria-hidden
            className="grid h-24 w-24 place-items-center rounded-full bg-primary/10 text-2xl font-semibold text-primary ring-1 ring-border"
          >
            {initials}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={onPick}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            <Camera className="h-4 w-4" />
            {shown ? "Change photo" : "Upload photo"}
          </Button>
          {shown ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={pending}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted">
          PNG, JPG, WebP, or GIF — saves automatically.
        </p>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    </div>
  );
}

/** Resize an image file in the browser to a square `size`×`size` JPEG data
 *  URL using a center-crop. Mirrors the helper in components/admin/user-form
 *  so the on-disk avatar payload looks the same regardless of which form the
 *  user edits from. */
async function resizeImageToDataUrl(file: File, size: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    const min = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - min) / 2;
    const sy = (img.naturalHeight - min) / 2;
    ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
