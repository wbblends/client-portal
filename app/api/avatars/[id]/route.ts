import { NextResponse } from "next/server";
import { readAvatar } from "@/lib/avatar-storage";
import { getUser } from "@/lib/users";

/**
 * Serves uploaded user avatars. Public-readable: avatars are not sensitive,
 * just user-set images, and any signed-in user might need to render any
 * other user's avatar (e.g. the admin user list).
 *
 * The id pattern `u_<hex>` is enforced by `readAvatar` so this route can't be
 * coerced into reading files outside the avatar dir.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const buf = readAvatar(id);
  if (!buf) {
    // 404, but only after confirming the user record exists — surface a
    // distinct status for "uploaded then removed" so admin UIs can fall back
    // to the initials avatar without retrying.
    const user = getUser(id);
    return NextResponse.json(
      { error: user ? "No avatar." : "Unknown user." },
      { status: 404 },
    );
  }
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buf.length),
      // 5min in shared caches; the avatarUrl includes a `?v=` cache-buster
      // that bumps on every upload, so stale caches are harmless.
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
