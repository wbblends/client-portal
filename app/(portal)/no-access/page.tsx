import { requireSession } from "@/lib/auth";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "No access — WB Blends" };

export default async function NoAccessPage() {
  await requireSession();
  return (
    <div className="page-pad-x py-10 lg:py-16 max-w-2xl mx-auto w-full">
      <Card>
        <CardHeader>
          <CardTitle>Nothing assigned to your account yet</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
