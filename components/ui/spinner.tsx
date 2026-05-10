import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<Size, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-8 w-8 border-[3px]",
  xl: "h-12 w-12 border-4",
};

export function Spinner({
  size = "md",
  className,
  label = "Loading",
}: {
  size?: Size;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block animate-spin rounded-full border-primary/20 border-t-primary align-[-0.125em]",
        sizeClasses[size],
        className,
      )}
    />
  );
}

export function FullPageSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Spinner size="xl" label={label} />
    </div>
  );
}
