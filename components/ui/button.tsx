import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm focus-visible:outline-primary",
  secondary:
    "bg-card text-foreground border border-border hover:border-border-strong hover:bg-accent",
  ghost:
    "text-foreground hover:bg-accent",
  outline:
    "bg-transparent text-foreground border border-border hover:bg-accent",
  danger:
    "bg-danger text-white hover:bg-danger/90",
};

// Mobile (touch) sizes meet Apple HIG 44pt / Material 48dp minimums; sm/md
// shrink at sm+ where input usually comes from a precise pointer. lg stays
// at 44px everywhere because it's the primary form-submit / call-to-action.
const sizeClasses: Record<Size, string> = {
  sm: "h-11 sm:h-8 px-3 text-sm",
  md: "h-11 sm:h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

/**
 * Canonical Button class string. Exported so non-button elements that need to
 * look like a button (e.g. `<Link>`) can share the exact same styling without
 * copy-pasting Tailwind classes that will inevitably drift.
 */
export function buttonClasses(opts?: {
  variant?: Variant;
  size?: Size;
  className?: string;
}): string {
  const { variant = "primary", size = "md", className } = opts ?? {};
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-60 select-none whitespace-nowrap",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
});
