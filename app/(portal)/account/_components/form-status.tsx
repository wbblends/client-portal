"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormStatus({
  ok,
  message,
  className,
}: {
  ok?: boolean;
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        ok
          ? "border-success/20 bg-success-soft text-success"
          : "border-danger/20 bg-danger-soft text-danger",
        className,
      )}
    >
      {ok ? (
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}
