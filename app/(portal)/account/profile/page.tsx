import { requireSession } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfilePhotoCard name={me.name} avatarUrl={me.avatarUrl ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display Name</CardTitle>
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
        </CardHeader>
        <CardContent>
          <PasswordCard />
        </CardContent>
      </Card>
    </div>
  );
}
