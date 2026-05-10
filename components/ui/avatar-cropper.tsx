"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Upload, RotateCcw, Trash2, X, Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Lets the user pick an image, see it inside a circular preview, drag to
 * reposition, then submit a 256×256 JPEG via the supplied upload action.
 *
 * The crop is always a centered square — the visual circle is achieved with
 * border-radius on the preview, which means we only ever store one
 * orientation and one content-type on disk. Drag-to-pan keeps the image
 * "covered" inside the circle so the corners are never blank.
 */

const VIEWPORT = 240; // px on screen
const OUTPUT = 256; // px square written to canvas
const QUALITY = 0.9; // JPEG quality
const MAX_SOURCE_BYTES = 8 * 1024 * 1024; // raw image cap before downscale
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

type UploadResult = { ok: boolean; message?: string };

export type AvatarCropperProps = {
  name: string;
  currentAvatarUrl?: string;
  /** Called with FormData containing the cropped square JPEG under field "avatar". */
  onUpload: (formData: FormData) => Promise<UploadResult>;
  /** Optional remove action — shows a "Remove photo" button when a current avatar is set. */
  onRemove?: () => Promise<UploadResult>;
};

export function AvatarCropper({
  name,
  currentAvatarUrl,
  onUpload,
  onRemove,
}: AvatarCropperProps) {
  const [stage, setStage] = useState<"idle" | "cropping" | "saving" | "removing">("idle");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // Revoke blob URLs when they go out of scope.
  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [imgUrl]);

  function reset(message?: string, isError = false) {
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setImgUrl(null);
    setImgEl(null);
    setOffset({ x: 0, y: 0 });
    setStage("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (message) {
      if (isError) {
        setError(message);
        setSuccess(null);
      } else {
        setSuccess(message);
        setError(null);
      }
    }
  }

  function handleFile(file: File) {
    setError(null);
    setSuccess(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only PNG, JPEG, WebP, or GIF images are supported.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("Source image is too large (max 8 MB).");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setImgUrl(url);
      setOffset({ x: 0, y: 0 });
      setStage("cropping");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Couldn't read that image. Try a different file.");
    };
    img.src = url;
  }

  // Pan bounds: scale image to "cover" the viewport, then constrain offset so
  // the image never reveals empty space inside the circle.
  const cover = imgEl
    ? Math.max(VIEWPORT / imgEl.naturalWidth, VIEWPORT / imgEl.naturalHeight)
    : 1;
  const scaledW = imgEl ? imgEl.naturalWidth * cover : VIEWPORT;
  const scaledH = imgEl ? imgEl.naturalHeight * cover : VIEWPORT;
  const maxOffsetX = Math.max(0, (scaledW - VIEWPORT) / 2);
  const maxOffsetY = Math.max(0, (scaledH - VIEWPORT) / 2);

  const clampOffset = useCallback(
    (x: number, y: number) => ({
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, x)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, y)),
    }),
    [maxOffsetX, maxOffsetY],
  );

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (stage !== "cropping") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clampOffset(dragRef.current.baseX + dx, dragRef.current.baseY + dy));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }

  async function save() {
    if (!imgEl) return;
    setStage("saving");
    setError(null);
    try {
      const blob = await renderCropToBlob(imgEl, offset);
      if (!blob) throw new Error("Couldn't render the cropped image.");
      const fd = new FormData();
      fd.append("avatar", blob, "avatar.jpg");
      const result = await onUpload(fd);
      if (!result.ok) {
        setStage("cropping");
        setError(result.message ?? "Upload failed.");
        return;
      }
      reset(result.message ?? "Profile photo updated.");
    } catch (err) {
      setStage("cropping");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  async function remove() {
    if (!onRemove) return;
    setStage("removing");
    setError(null);
    try {
      const result = await onRemove();
      if (!result.ok) {
        setStage("idle");
        setError(result.message ?? "Couldn't remove the photo.");
        return;
      }
      reset(result.message ?? "Profile photo removed.");
    } catch (err) {
      setStage("idle");
      setError(err instanceof Error ? err.message : "Couldn't remove the photo.");
    }
  }

  // Idle: show current avatar + Choose-image button + (optional) Remove.
  if (stage === "idle" || stage === "removing") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={name} src={currentAvatarUrl} size={72} />
          <div className="text-sm">
            <div className="font-medium text-foreground">
              {currentAvatarUrl ? "Custom photo" : "Initials placeholder"}
            </div>
            <div className="text-muted text-xs mt-0.5">
              {currentAvatarUrl
                ? "Choose a new image to replace it."
                : "Upload an image to replace the initials."}
            </div>
          </div>
        </div>

        <label className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-accent/30 p-4 text-center cursor-pointer hover:border-border-strong hover:bg-accent/60 transition-colors">
          <Upload className="h-5 w-5 text-muted" />
          <div className="text-sm font-medium text-foreground-soft">Choose image</div>
          <div className="text-xs text-muted">PNG, JPEG, WebP, GIF · up to 8 MB</div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            className="sr-only"
            onChange={e => {
              const f = e.currentTarget.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>

        {error && <Banner tone="error">{error}</Banner>}
        {success && <Banner tone="success">{success}</Banner>}

        {currentAvatarUrl && onRemove && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={stage === "removing"}
            onClick={remove}
          >
            <Trash2 className="h-4 w-4" />
            {stage === "removing" ? "Removing…" : "Remove photo"}
          </Button>
        )}
      </div>
    );
  }

  // Cropping / saving: show interactive preview.
  return (
    <div className="space-y-4">
      <div
        className="relative mx-auto select-none touch-none"
        style={{ width: VIEWPORT, height: VIEWPORT }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute inset-0 overflow-hidden rounded-full ring-2 ring-primary/40 bg-accent cursor-grab active:cursor-grabbing"
        >
          {imgUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl}
              alt="Crop preview"
              className="absolute pointer-events-none"
              draggable={false}
              style={{
                width: scaledW,
                height: scaledH,
                left: (VIEWPORT - scaledW) / 2 + offset.x,
                top: (VIEWPORT - scaledH) / 2 + offset.y,
                maxWidth: "none",
              }}
            />
          )}
        </div>
        <div className="absolute inset-0 rounded-full ring-1 ring-border pointer-events-none" />
      </div>

      <p className="text-center text-xs text-muted">Drag inside the circle to reposition.</p>

      {error && <Banner tone="error">{error}</Banner>}

      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => reset()}
          disabled={stage === "saving"}
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOffset({ x: 0, y: 0 })}
          disabled={stage === "saving"}
        >
          <RotateCcw className="h-4 w-4" />
          Recenter
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={stage === "saving"}
        >
          <Check className="h-4 w-4" />
          {stage === "saving" ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "error"
          ? "border-danger/20 bg-danger-soft text-danger"
          : "border-success/20 bg-success-soft text-success",
      )}
    >
      {children}
    </div>
  );
}

async function renderCropToBlob(
  img: HTMLImageElement,
  offset: { x: number; y: number },
): Promise<Blob | null> {
  const cover = Math.max(VIEWPORT / img.naturalWidth, VIEWPORT / img.naturalHeight);
  const srcSize = VIEWPORT / cover; // size of the source square in original-image px
  const cx = img.naturalWidth / 2 - offset.x / cover;
  const cy = img.naturalHeight / 2 - offset.y / cover;
  const sx = Math.max(0, cx - srcSize / 2);
  const sy = Math.max(0, cy - srcSize / 2);

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);

  return new Promise<Blob | null>(resolve => {
    canvas.toBlob(b => resolve(b), "image/jpeg", QUALITY);
  });
}
