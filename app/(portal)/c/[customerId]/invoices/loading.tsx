import { Skeleton, CardSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function InvoicesLoading() {
  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-6">
      <PageHeaderSkeleton />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]"
          >
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-3 h-7 w-32" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>

      <CardSkeleton rows={8} />
    </div>
  );
}
