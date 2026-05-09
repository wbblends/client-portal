import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { ALL_PERMISSIONS } from "@/lib/users";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewUserForm } from "../_components/new-user-form";

export const metadata = { title: "New user — WB Blends Admin" };

export default async function NewUserPage() {
  await requireSuperAdmin();

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[800px] mx-auto space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to users
        </Link>
        <h1 className="mt-2 font-display text-[30px] leading-[1.1] tracking-tight text-foreground">
          New <em className="not-italic text-primary">user</em>.
        </h1>
        <p className="mt-1 text-sm text-muted">
          Create a new account. Profile photos can be uploaded after the user is created.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>
            Choose a username and email. Permissions can be tweaked later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewUserForm allPermissions={ALL_PERMISSIONS} />
        </CardContent>
      </Card>
    </div>
  );
}
