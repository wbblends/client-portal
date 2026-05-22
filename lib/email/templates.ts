/**
 * Plain-text + HTML email bodies. Kept simple — no MJML, no framework.
 * Inline styles only so they render in every client; no images yet.
 */

import {
  QUESTIONS,
  SCALES,
  responseAverage,
  npsCategory,
  type SurveyResponse,
} from "@/lib/survey/questions";

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

/**
 * Notification sent to the WB Blends team every time a customer submits the
 * Customer Experience Survey. Carries the full response — every rating, every
 * comment, both open-ended answers — so it's actionable straight from the
 * inbox without opening the portal.
 */
export function surveyNotificationEmail(
  response: SurveyResponse,
): { subject: string; html: string; text: string } {
  const name = `${response.firstName} ${response.lastName}`.trim() || "Anonymous";
  const avg = responseAverage(response);
  const nps = response.ratings.q22;
  const npsLine =
    typeof nps === "number"
      ? `${nps}/10 (${npsCategory(nps)})`
      : "—";
  const subject = `Survey response — ${name} · ${avg.toFixed(1)}/5 avg`;

  const ratingLines = QUESTIONS.map(q => {
    const value = response.ratings[q.id];
    const scale = SCALES[q.scale];
    const opt = scale.options.find(o => o.value === value);
    const shown =
      typeof value === "number"
        ? `${value}/${scale.max}${opt ? ` — ${opt.label}` : ""}`
        : "—";
    const comment = response.comments[q.id];
    return { q, shown, comment: comment ?? "" };
  });

  // ── plain text ──
  const textRatings = ratingLines
    .map(r => {
      const base = `  Q${r.q.number}. ${r.q.text}\n      ${r.shown}`;
      return r.comment ? `${base}\n      Comment: ${r.comment}` : base;
    })
    .join("\n");
  const text = `New Customer Experience Survey response.

Respondent: ${name}
Email:      ${response.email}
${response.customerId ? `Customer:   ${response.customerId}\n` : ""}Submitted:  ${response.submittedAt}

Overall average (1-5 questions): ${avg.toFixed(2)}
Likelihood to recommend: ${npsLine}

Ratings
${textRatings}

If you could change one thing:
${response.changeOne || "(no answer)"}

Upcoming projects we can support:
${response.upcoming || "(no answer)"}

— WB Blends Portal`;

  // ── html ──
  const htmlRatings = ratingLines
    .map(r => {
      const commentRow = r.comment
        ? `<div style="margin-top:4px;font-size:13px;color:#5f6473;border-left:2px solid #6540e3;padding-left:8px;">${escapeHtml(r.comment)}</div>`
        : "";
      return `<tr>
        <td style="padding:8px 8px 8px 0;font-size:13px;color:#1f1f1f;vertical-align:top;width:62%;">
          <strong>Q${r.q.number}.</strong> ${escapeHtml(r.q.text)}${commentRow}
        </td>
        <td style="padding:8px 0;font-size:13px;color:#111;text-align:right;white-space:nowrap;vertical-align:top;">${escapeHtml(r.shown)}</td>
      </tr>`;
    })
    .join("");
  const html = wrap(`
    <p style="margin-top:0;">New <strong>Customer Experience Survey</strong> response.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#1f1f1f;margin-bottom:18px;">
      <tr><td style="padding:3px 0;color:#888;width:96px;">Respondent</td><td style="padding:3px 0;font-weight:600;">${escapeHtml(name)}</td></tr>
      <tr><td style="padding:3px 0;color:#888;">Email</td><td style="padding:3px 0;">${escapeHtml(response.email)}</td></tr>
      ${response.customerId ? `<tr><td style="padding:3px 0;color:#888;">Customer</td><td style="padding:3px 0;">${escapeHtml(response.customerId)}</td></tr>` : ""}
      <tr><td style="padding:3px 0;color:#888;">Overall</td><td style="padding:3px 0;font-weight:600;">${avg.toFixed(2)} / 5 avg · recommend ${escapeHtml(npsLine)}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #ececf2;">${htmlRatings}</table>
    <div style="margin-top:20px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#888;">If you could change one thing</div>
      <p style="margin:4px 0 0;font-size:14px;">${escapeHtml(response.changeOne) || "<span style='color:#aaa;'>(no answer)</span>"}</p>
    </div>
    <div style="margin-top:16px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#888;">Upcoming projects we can support</div>
      <p style="margin:4px 0 0;font-size:14px;">${escapeHtml(response.upcoming) || "<span style='color:#aaa;'>(no answer)</span>"}</p>
    </div>
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
