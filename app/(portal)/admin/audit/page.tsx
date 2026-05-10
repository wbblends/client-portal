import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { describeEvent, listEvents } from "@/lib/audit";
import { Card } from "@/components/ui/card";
import { AuditTable } from "../users/_components/audit-table";

export const metadata = { title: "Activity log — WB Blends Admin" };

export default async function AuditPage() {
  await requireSuperAdmin();
  const events = listEvents({ limit: 500 });
  const rows = events.map(e => ({
    id: e.id,
    ts: e.ts,
    action: e.action,
    actor: e.actorUsername,
    target: e.targetUsername ?? null,
    targetId: e.targetId ?? null,
    summary: describeEvent(e),
  }));

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to users
        </Link>
        <h1 className="mt-2 font-display text-[34px] leading-[1.1] tracking-tight text-foreground">
          Activity <em className="not-italic text-primary">log</em>.
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every admin action and authentication event, newest first. Up to the most recent 500
          shown — older entries remain in the log file.
        </p>
      </div>
      <Card className="overflow-hidden">
        <AuditTable rows={rows} showActor />
      </Card>
    </div>
  );
}
