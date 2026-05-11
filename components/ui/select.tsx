import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Styled native <select> with a chevron icon overlay. Matches the visual
 * weight of <Input> (same border, padding, focus ring) so dropdowns stop
 * looking like raw browser chrome next to text fields.
 *
 * Use this anywhere a plain <select> would appear in user-facing UI —
 * payment terms, file type, role pickers, etc.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <span className="relative inline-block w-full">
        <select
          ref={ref}
          className={cn(
            // The native chrome is removed (`appearance-none`) and replaced
            // by the chevron rendered below; padding-right leaves space for it.
            "appearance-none h-10 w-full rounded-lg border border-border bg-card pl-3 pr-9 text-sm text-foreground",
            "focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none",
            "hover:border-border-strong",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "transition-colors",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        />
      </span>
    );
  },
);
