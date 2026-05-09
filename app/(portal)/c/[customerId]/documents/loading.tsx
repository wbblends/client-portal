import { Skeleton, CardSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function DocumentsLoading() {
  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-6">
      <PageHeaderSkeleton />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-24" />
      </div>

      <CardSkeleton rows={6} />
    </div>
  );
}
