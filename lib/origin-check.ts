/**
 * Defense against CSRF on state-changing JSON endpoints.
 *
 * For same-site SameSite=Lax cookies, top-level POSTs from another origin will
 * not include the session cookie — but JSON `fetch()` from a malicious page
 * still warrants an Origin pin. Browsers always send `Origin` on cross-origin
 * requests; many also send it on same-origin POSTs.
 *
 * Rule: require Origin (or Referer as a fallback for the rare client that
 * omits Origin) and require it to match the request's Host header.
 */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) return originHost(origin) === host;

  const referer = request.headers.get("referer");
  if (referer) return originHost(referer) === host;

  return false;
}

function originHost(value: string): string | null {
  try {
    const url = new URL(value);
    return url.host;
  } catch {
    return null;
  }
}
