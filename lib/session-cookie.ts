/**
 * Just the cookie name — extracted so middleware (Edge runtime) can import it
 * without dragging the rest of `lib/auth.ts` (which uses Node-only APIs like
 * Buffer for session encoding) into the Edge bundle.
 */
export const SESSION_COOKIE = "wbb_session";
