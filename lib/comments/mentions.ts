/**
 * Shared utilities around mentions: parsing handles out of comment bodies and
 * sending the notification emails. Lives outside store.ts because the email
 * side has runtime deps (Resend) that the store doesn't need.
 */
import { sendEmail, publicBaseUrl } from "@/lib/email/sender";
import { mentionEmail } from "@/lib/email/templates";
import { getUsersByUsername } from "@/lib/comments/store";

const MENTION_RE = /(?:^|[^\w])@([a-z0-9._-]{2,40})/gi;
const EXCERPT_LIMIT = 240;

/** Pull `@handle` mentions out of a comment body. Case-preserved as typed —
 *  the store's resolve step lowercases for matching. */
export function parseMentionHandles(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) {
    out.add(m[1]);
  }
  return Array.from(out);
}

/** Truncate to a single-line excerpt for emails. Collapses newlines so the
 *  blockquote stays one paragraph. */
export function commentExcerpt(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= EXCERPT_LIMIT) return flat;
  return flat.slice(0, EXCERPT_LIMIT - 1).trimEnd() + "…";
}

export async function notifyMentions(args: {
  mentionedUsernames: string[];
  mentionerUsername: string;
  mentionerName: string;
  route: string;
  threadId: string;
  body: string;
}): Promise<void> {
  // Don't notify the author themselves if they happened to @ their own handle.
  const recipients = args.mentionedUsernames.filter(u => u !== args.mentionerUsername);
  if (recipients.length === 0) return;

  const users = await getUsersByUsername(recipients);
  const url = buildThreadUrl(args.route, args.threadId);
  const excerpt = commentExcerpt(args.body);
  const routeLabel = friendlyRouteLabel(args.route);

  // Send sequentially — at the typical mention count (1–3) the per-call
  // overhead doesn't matter and a serial loop keeps the Resend rate-limit
  // surface area small.
  for (const u of users) {
    try {
      const msg = mentionEmail({
        recipientName: u.name,
        mentionerName: args.mentionerName,
        routeLabel,
        threadUrl: url,
        excerpt,
      });
      await sendEmail({ to: u.email, ...msg });
    } catch (err) {
      console.error(`[comments] mention email to ${u.email} failed`, err);
    }
  }
}

function buildThreadUrl(route: string, threadId: string): string {
  // The overlay opens whichever thread id is in `?wbb_comment=`.
  const base = publicBaseUrl().replace(/\/$/, "");
  const sep = route.includes("?") ? "&" : "?";
  return `${base}${route}${sep}wbb_comment=${encodeURIComponent(threadId)}`;
}

function friendlyRouteLabel(route: string): string {
  // Strip query/hash, leave the path intact — a friendly path is more useful
  // to a recipient than trying to look up a page name from a registry.
  const noQuery = route.split("?")[0].split("#")[0];
  return noQuery || "/";
}
