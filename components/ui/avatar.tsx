/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Renders a circular avatar. When a `src` is provided we use it directly:
 *  - Data URLs (uploaded photos held in memory) render via plain `<img>` since
 *    `next/image` can be picky about them.
 *  - File or absolute URLs use `next/image` for optimization.
 *  - When `src` is missing, the user's initials are shown on a tinted disc.
 */
export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  const initials = getInitials(name);
  const baseClasses = cn(
    "shrink-0 rounded-full object-cover ring-1 ring-border bg-card",
    className,
  );

  if (src) {
    if (src.startsWith("data:")) {
      return (
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          className={baseClasses}
          style={{ width: size, height: size }}
        />
      );
    }
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={baseClasses}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary/10 text-primary font-semibold",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}
    >
      {initials}
    </div>
  );
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
