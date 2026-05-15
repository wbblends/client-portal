import { requireSession } from "@/lib/auth";

/**
 * Portal home — the default landing page after login. Intentionally empty
 * for now; content will be added later. Lives inside the (portal) route
 * group so it inherits the standard sidebar/shell chrome.
 */
export default async function HomePage() {
  const user = await requireSession();

  return (
    <div className="page-container page-pad-x page-pad-y">
      <h1 className="font-display text-3xl tracking-tight text-foreground">
        Welcome, {user.name.split(" ")[0]}
      </h1>
    </div>
  );
}
