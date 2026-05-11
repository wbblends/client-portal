import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          // 44px on mobile (Apple HIG touch target) → 40px sm+; 16px text on
          // mobile prevents iOS from auto-zooming the page on focus.
          "h-11 sm:h-10 w-full rounded-lg border border-border bg-card px-3 text-base sm:text-sm",
          "placeholder:text-muted-soft",
          "focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "transition-colors",
          className,
        )}
        {...props}
      />
    );
  },
);
