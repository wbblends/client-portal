import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { setHomeUrl } from "@/lib/users/store";

/**
 * Save (POST) or clear (DELETE) the signed-in user's "set as homepage" URL.
 *
 * The URL is stored as a same-origin relative path including query string —
 * that's the whole point of the feature: pin a page with filters applied.
 *
 * We validate that the value is a relative path that starts with `/` and
 * doesn't smuggle in a protocol-relative or absolute URL. That keeps the
 * later `redirect(session.homeUrl)` in app/page.tsx from being turned into
 * an open-redirect by a hostile request body.
 */
export async function POST(request: NextRequest) {
  const me = await requireSession();
  const body = (await request.json().catch(() => ({}))) as { url?: string };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!isSafeRelativeUrl(url)) {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }
  await setHomeUrl(me.username, url);
  return NextResponse.json({ ok: true, homeUrl: url });
}

export async function DELETE() {
  const me = await requireSession();
  await setHomeUrl(me.username, null);
  return NextResponse.json({ ok: true });
}

function isSafeRelativeUrl(value: string): boolean {
  if (!value) return false;
  if (value.length > 2048) return false;
  // Must start with a single `/` — reject protocol-relative `//evil.com` and
  // absolute `https://...`. Also reject backslashes which some browsers
  // normalize to forward slashes when constructing redirects.
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  return true;
}
