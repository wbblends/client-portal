/**
 * Email provider stub. The admin UI shows reset links inline so they're
 * usable even with no provider configured. When you wire up a real provider
 * (Resend / Postmark / SendGrid / SES / SMTP), implement `sendEmail` to
 * dispatch through it and the rest of the app needs no changes.
 *
 * Required env vars when integrating:
 *  - EMAIL_FROM           — e.g. "WB Blends <noreply@wbblends.com>"
 *  - EMAIL_PROVIDER_KEY   — provider API key (or SMTP creds)
 *  - PORTAL_URL           — public URL for building absolute links (e.g.
 *                           "https://portal.wbblends.com")
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendResult = { ok: true } | { ok: false; reason: string };

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  // Demo mode: print to the server log.  Wire up a real provider here.
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[email-stub] would send →\n  to: ${message.to}\n  subject: ${message.subject}\n  text: ${message.text}`,
    );
  }
  return { ok: true };
}

export function portalBaseUrl(requestOrigin?: string): string {
  return process.env.PORTAL_URL || requestOrigin || "http://localhost:3000";
}

export function buildResetUrl(rawToken: string, requestOrigin?: string): string {
  return `${portalBaseUrl(requestOrigin)}/reset/${encodeURIComponent(rawToken)}`;
}
