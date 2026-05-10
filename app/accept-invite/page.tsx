import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { AcceptInviteForm } from "./accept-form";

export const metadata = { title: "Accept invite — WB Blends" };

export default async function AcceptInvitePage(props: PageProps<"/accept-invite">) {
  // If already signed in, an invite link doesn't make sense — drop them on the dashboard.
  const session = await getSession();
  if (session) redirect("/dashboard");

  const params = await props.searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-surface">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <Image
          src="/brand/swirl.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      <div className="relative grid min-h-dvh place-items-center px-6 py-10">
        <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card-hover)]">
          <Logo size="lg" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
            Set up your account
          </h1>
          <p className="mt-1 text-sm text-muted">
            Choose a username and password to finish accepting your invitation.
          </p>
          <div className="mt-6">
            <AcceptInviteForm token={token} />
          </div>
        </div>
      </div>
    </main>
  );
}
