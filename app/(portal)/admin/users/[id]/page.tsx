import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { ALL_PERMISSIONS, getUser, ROLE_LABELS } from "@/lib/users";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "../_components/profile-form";
import { AvatarManager } from "../_components/avatar-manager";
import { RolePermissionsForm } from "../_components/role-permissions-form";
import { PasswordResetForm } from "../_components/password-reset-form";
import { StatusToggle } from "../_components/status-toggle";
import { DangerZone } from "../_components/danger-zone";

export const metadata = { title: "Edit user — WB Blends Admin" };

export default async function UserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireSuperAdmin();
  const { id } = await params;
  const user = getUser(id);
  if (!user) notFound();

  const isSelf = user.id === me.id;

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1100px] mx-auto space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to users
        </Link>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-[30px] leading-[1.1] tracking-tight text-foreground">
            {user.name}
          </h1>
          <Badge tone={user.role === "super_admin" ? "info" : user.role === "admin" ? "warning" : "neutral"}>
            {ROLE_LABELS[user.role]}
          </Badge>
          {user.status === "disabled" && <Badge tone="warning">Disabled</Badge>}
          {isSelf && (
            <span className="text-[11px] uppercase tracking-wide text-primary font-semibold">You</span>
          )}
        </div>
        <div className="mt-1 text-sm text-muted">
          @{user.username} · {user.email}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile photo</CardTitle>
              <CardDescription>
                PNG, JPEG, WebP, or GIF. Max 2 MB. Shown across the portal next to this user.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AvatarManager userId={user.id} name={user.name} avatarUrl={user.avatarUrl} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account status</CardTitle>
              <CardDescription>
                Disabled users can&apos;t sign in but their record is preserved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatusToggle userId={user.id} status={user.status} disabledForSelf={isSelf} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Name, username, and email.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                userId={user.id}
                defaultValues={{
                  name: user.name,
                  username: user.username,
                  email: user.email,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Role & permissions</CardTitle>
              <CardDescription>
                Super admins always have full access. Permissions for non-super-admins control which
                portal sections they can open.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RolePermissionsForm
                userId={user.id}
                role={user.role}
                permissions={user.permissions}
                allPermissions={ALL_PERMISSIONS}
                disableRoleChange={isSelf}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reset password</CardTitle>
              <CardDescription>
                Set a new password manually, or generate a strong temporary one to share with the user.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordResetForm userId={user.id} />
            </CardContent>
          </Card>

          <Card className="border-danger/30">
            <CardHeader>
              <CardTitle className="text-danger">Danger zone</CardTitle>
              <CardDescription>
                Deleting a user removes their record and revokes their session immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DangerZone userId={user.id} username={user.username} disableDelete={isSelf} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
