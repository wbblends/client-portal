import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-lg border-2 border-border-strong bg-card px-4 text-base",
          "placeholder:text-muted-soft",
          "focus:border-primary focus:ring-4 focus:ring-primary/25 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "transition-colors",
          className,
        )}
        {...props}
      />
    );
  },
);
