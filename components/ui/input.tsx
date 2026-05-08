import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm",
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
