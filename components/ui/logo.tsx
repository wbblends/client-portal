import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * WB Blends lockup. The single transparent-PNG file is the source of truth —
 * cursive `wb` + serif "Blends" + `27+` superscript baked together. We size
 * by height (the natural aspect is ~3.7:1) so the lockup keeps its proportions.
 *
 * The `mark` variant falls back to the standalone cursive `wb` for tight spaces.
 */
export function Logo({
  className,
  size = "md",
  mark = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  mark?: boolean;
}) {
  if (mark) {
    const px = size === "sm" ? 24 : size === "lg" ? 40 : 30;
    return (
      <Image
        src="/brand/wb-mark.png"
        alt="WB Blends"
        width={px}
        height={px}
        priority
        className={cn("object-contain mix-blend-multiply", className)}
      />
    );
  }
  const h = size === "sm" ? 22 : size === "lg" ? 44 : 30;
  const w = Math.round(h * 3.7);
  return (
    <Image
      src="/brand/wb-blends-lockup.png"
      alt="WB Blends"
      width={w}
      height={h}
      priority
      className={cn("object-contain", className)}
    />
  );
}
