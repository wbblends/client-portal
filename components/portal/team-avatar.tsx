"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Round avatar with graceful fallback. Renders the image when src is provided
 * and loads; otherwise (no src, 404, or load error) shows initials on a soft
 * primary tile. Used on the contact page and admin users table so missing
 * `/avatars/<user>.jpg` files don't render as broken images.
 */
export function TeamAvatar({
  src,
  name,
  size = 44,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const initials = name
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const dim = { width: size, height: size };

  if (!src || errored) {
    return (
      <div
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-primary/10 text-primary font-semibold",
          className,
        )}
        style={{ ...dim, fontSize: Math.round(size * 0.34) }}
      >
        {initials}
      </div>
    );
  }

  // next/image can't optimize data: URLs — pass `unoptimized` to render them
  // through directly (used for admin-uploaded avatars stored inline).
  const unoptimized = src.startsWith("data:");

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      unoptimized={unoptimized}
      onError={() => setErrored(true)}
      className={cn("shrink-0 rounded-full object-cover ring-1 ring-border", className)}
    />
  );
}
