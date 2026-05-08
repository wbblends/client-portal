import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border-border-strong text-primary",
          "focus:ring-2 focus:ring-primary/30 focus:ring-offset-0",
          className,
        )}
        {...props}
      />
    );
  },
);
