import { requireSession } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export const metadata = { title: "No access — WB Blends" };

export default async function NoAccessPage() {
  const user = await requireSession();
  return (
    <div className="page-pad-x py-10 lg:py-16 max-w-2xl mx-auto w-full">
      <Card>
        <CardHeader>
          <CardTitle>Nothing assigned to your account yet</CardTitle>
          <CardDescription>
            Hi {user.name.split(" ")[0]} — your account exists, but no dashboards have been
            assigned to it. Reach out to your account manager to get access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            If you&apos;re a WB Blends admin, edit{" "}
            <code className="rounded bg-accent px-1 py-0.5 text-xs">lib/users/users.json</code> to
            update permissions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
