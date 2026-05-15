import { ShieldCheck, ShieldAlert } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MfaPanel } from "@/components/account/mfa-panel";

export const metadata = { title: "Security — WB Blends" };

export default async function SecurityPage() {
  const me = await requireSession();
  return (
    <div
      className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7"
      style={{ maxWidth: "760px" }}
    >
      <div>
        <p className="text-sm text-muted">Account</p>
        <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
          Security
        </h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Two-factor authentication</CardTitle>
            </div>
            {me.mfaEnabled ? (
              <Badge tone="success">
                <ShieldCheck className="h-3.5 w-3.5" /> Enabled
              </Badge>
            ) : (
              <Badge tone="warning">
                <ShieldAlert className="h-3.5 w-3.5" /> Not set up
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <MfaPanel enabled={me.mfaEnabled} />
        </CardContent>
      </Card>
    </div>
  );
}
