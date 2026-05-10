import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// Spinner colour per variant — dark stroke on light surfaces, white on filled.
const spinnerClasses: Record<Variant, string> = {
  primary: "border-primary-foreground/30 border-t-primary-foreground",
  secondary: "border-foreground/15 border-t-foreground",
  ghost: "border-foreground/15 border-t-foreground",
  outline: "border-foreground/15 border-t-foreground",
  danger: "border-white/30 border-t-white",
};

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

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-60 select-none whitespace-nowrap",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner size="sm" className={spinnerClasses[variant]} />}
      {children}
    </button>
  );
});
