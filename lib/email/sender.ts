/**
 * Outbound email — Resend if `RESEND_API_KEY` is set, otherwise a console
 * fallback so the rest of the system works without email plumbing.
 *
 * Env vars:
 *  - RESEND_API_KEY      — Resend secret key. When unset, emails log to stdout.
 *  - EMAIL_FROM          — defaults to "WB Blends Portal <noreply@wbcustomerportal.com>"
 *  - PUBLIC_BASE_URL     — public origin used to build invite/reset links.
 *                          Falls back to http://localhost:3000 in dev.
 *
 * Domain note: `wbcustomerportal.com` needs to be verified in the Resend
 * dashboard (DKIM + SPF DNS records) before mail will deliver to inboxes.
 * Until then RESEND_API_KEY can be set with the address pointing at any
 * Resend-verified sender — the code doesn't change.
 */

const DEFAULT_FROM = "WB Blends Portal <noreply@wbcustomerportal.com>";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;

  if (!apiKey) {
    console.log(
      `[email:fallback] (RESEND_API_KEY unset — printing instead of sending)\n` +
        `  From:    ${from}\n` +
        `  To:      ${msg.to}\n` +
        `  Subject: ${msg.subject}\n` +
        `  ─── text ───\n${indent(msg.text)}`,
    );
    return;
  }

  const { Resend } = await import("resend");
  const client = new Resend(apiKey);
  const { error } = await client.emails.send({
    from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}

export function publicBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
}

function indent(s: string): string {
  return s
    .split("\n")
    .map(l => "    " + l)
    .join("\n");
}
