import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "h-6 w-6 rounded border-2 border-border-strong text-primary cursor-pointer",
          "focus:ring-4 focus:ring-primary/30 focus:ring-offset-0",
          className,
        )}
        {...props}
      />
    );
  },
);
