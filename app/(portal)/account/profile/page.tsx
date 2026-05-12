import { requireSession } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ProfilePhotoCard } from "@/components/account/profile-photo-card";
import { ProfileFieldsCard } from "@/components/account/profile-fields-card";
import { PasswordCard } from "@/components/account/password-card";

export const metadata = { title: "Profile — WB Blends" };

export default async function ProfilePage() {
  const me = await requireSession();
  return (
    <div
      className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7"
      style={{ maxWidth: "760px" }}
    >
      <div>
        <p className="text-sm text-muted">Account</p>
        <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
          Profile
        </h1>
        <p className="mt-1 text-sm text-muted">
          Update how your name and photo appear across the portal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>
            A square 256-pixel image works best. The new photo saves the moment you pick it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfilePhotoCard name={me.name} avatarUrl={me.avatarUrl ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display name</CardTitle>
          <CardDescription>
            Shown in the sidebar, on comments you leave, and in admin lists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileFieldsCard
            initialName={me.name}
            username={me.username}
            email={me.email}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Choose something long. We&apos;ll keep you signed in on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordCard />
        </CardContent>
      </Card>
    </div>
  );
}
