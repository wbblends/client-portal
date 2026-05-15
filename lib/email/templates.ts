/**
 * Plain-text + HTML email bodies. Kept simple — no MJML, no framework.
 * Inline styles only so they render in every client; no images yet.
 */

export type InviteVars = {
  name: string;
  inviteUrl: string;
  inviterName: string;
};

export function inviteEmail(v: InviteVars): { subject: string; html: string; text: string } {
  const subject = "You've been invited to the WB Blends Portal";
  const text = `Hi ${v.name},

${v.inviterName} has set up an account for you on the WB Blends customer portal.

To finish setting up your account and choose a password, open this link:

${v.inviteUrl}

The link is good for 7 days. If it expires, ask ${v.inviterName} to send you a new one.

— WB Blends`;
  const html = wrap(`
    <p>Hi ${escapeHtml(v.name)},</p>
    <p>${escapeHtml(v.inviterName)} has set up an account for you on the WB Blends customer portal.</p>
    <p>To finish setting up your account and choose a password, click the button below.</p>
    <p style="margin: 28px 0;">
      <a href="${escapeAttr(v.inviteUrl)}" style="background:#6540e3;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">
        Set my password
      </a>
    </p>
    <p style="color:#5f6473;font-size:13px;">The link is good for 7 days. If it expires, ask ${escapeHtml(v.inviterName)} to send you a new one.</p>
    <p style="color:#888;font-size:12px;">If the button doesn't work, paste this URL into your browser:<br><span style="word-break:break-all;">${escapeHtml(v.inviteUrl)}</span></p>
  `);
  return { subject, html, text };
}

export type MentionVars = {
  recipientName: string;
  mentionerName: string;
  routeLabel: string; // e.g. "/c/wb-blends/overview" or a friendlier label
  threadUrl: string;  // deep link that scrolls to + opens the pin
  excerpt: string;    // the comment body, plain text (truncated client-side)
};

export function mentionEmail(v: MentionVars): { subject: string; html: string; text: string } {
  const subject = `${v.mentionerName} mentioned you in a comment`;
  const text = `Hi ${v.recipientName},

${v.mentionerName} mentioned you in a comment on ${v.routeLabel}:

  "${v.excerpt}"

Open the comment:
${v.threadUrl}

— WB Blends`;
  const html = wrap(`
    <p>Hi ${escapeHtml(v.recipientName)},</p>
    <p><strong>${escapeHtml(v.mentionerName)}</strong> mentioned you in a comment on <code style="background:#f2f0ff;padding:2px 6px;border-radius:4px;font-size:13px;">${escapeHtml(v.routeLabel)}</code>.</p>
    <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #6540e3;background:#f2f0ff;color:#1f1f1f;border-radius:0 8px 8px 0;font-size:14px;">
      ${escapeHtml(v.excerpt)}
    </blockquote>
    <p style="margin: 28px 0;">
      <a href="${escapeAttr(v.threadUrl)}" style="background:#6540e3;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">
        Open comment
      </a>
    </p>
    <p style="color:#888;font-size:12px;">If the button doesn't work, paste this URL into your browser:<br><span style="word-break:break-all;">${escapeHtml(v.threadUrl)}</span></p>
  `);
  return { subject, html, text };
}

export type ResetVars = {
  name: string;
  resetUrl: string;
};

export function resetEmail(v: ResetVars): { subject: string; html: string; text: string } {
  const subject = "Reset your WB Blends Portal password";
  const text = `Hi ${v.name},

You (or someone using your email) asked to reset your WB Blends Portal password. Open this link to choose a new one:

${v.resetUrl}

The link is good for 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.

— WB Blends`;
  const html = wrap(`
    <p>Hi ${escapeHtml(v.name)},</p>
    <p>You (or someone using your email) asked to reset your WB Blends Portal password.</p>
    <p style="margin: 28px 0;">
      <a href="${escapeAttr(v.resetUrl)}" style="background:#6540e3;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">
        Choose a new password
      </a>
    </p>
    <p style="color:#5f6473;font-size:13px;">The link is good for 1 hour.</p>
    <p style="color:#5f6473;font-size:13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    <p style="color:#888;font-size:12px;">Or paste this into your browser:<br><span style="word-break:break-all;">${escapeHtml(v.resetUrl)}</span></p>
  `);
  return { subject, html, text };
}

function wrap(inner: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111111;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #ececf2;border-radius:14px;padding:32px;">
    <div style="font-weight:700;font-size:18px;letter-spacing:-0.01em;margin-bottom:18px;">WB Blends</div>
    ${inner}
  </div>
  <div style="text-align:center;color:#9aa0ad;font-size:11px;margin:0 0 32px;">WB Blends · Western Botanicals</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
