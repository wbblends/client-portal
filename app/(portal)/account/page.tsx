import { requireSession } from "@/lib/auth";
import { getUser, ROLE_LABELS } from "@/lib/users";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MyProfileForm } from "./_components/my-profile-form";
import { MyAvatarManager } from "./_components/my-avatar-manager";
import { ChangePasswordForm } from "./_components/change-password-form";
import { TwoFactorSection } from "./_components/two-factor-section";

export const metadata = { title: "My account — WB Blends" };

export default async function AccountPage() {
  const session = await requireSession();
  const user = getUser(session.id);
  if (!user) {
    // Edge case: deleted while signed in. The next request would clear it; for
    // this render, fall back to session data.
    return null;
  }

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1100px] mx-auto space-y-6">
      <div>
        <h1 className="font-display text-[34px] leading-[1.1] tracking-tight text-foreground">
          My <em className="not-italic text-primary">account</em>.
        </h1>
        <p className="mt-1 text-sm text-muted">
          Update your profile, change your password, and manage two-factor authentication.
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Badge tone={user.role === "super_admin" ? "info" : user.role === "admin" ? "warning" : "neutral"}>
            {ROLE_LABELS[user.role]}
          </Badge>
          {user.twoFactorEnabled && <Badge tone="info">2FA on</Badge>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile photo</CardTitle>
              <CardDescription>
                PNG, JPEG, WebP, or GIF. Max 2 MB.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MyAvatarManager name={user.name} avatarUrl={user.avatarUrl} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Your name and email. Username and role are managed by an administrator.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MyProfileForm
                username={user.username}
                defaultValues={{ name: user.name, email: user.email }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>
                Confirm your current password to set a new one. Other devices will be signed out.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-factor authentication</CardTitle>
              <CardDescription>
                {user.twoFactorEnabled
                  ? "2FA is on. Disable it (with your password) if you need to switch devices."
                  : "Add a second factor with any TOTP app (Authy, 1Password, Google Authenticator, etc.). Strongly recommended for super admins."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TwoFactorSection enabled={user.twoFactorEnabled} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
