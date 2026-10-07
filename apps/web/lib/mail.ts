/**
 * Transactional e-mail through the Mailgun HTTP API (same integration as krizaka.com):
 *   MAILGUN_API_KEY + MAILGUN_DOMAIN (the sending subdomain, e.g. mg.orochia.com)
 *   (+ MAILGUN_API_URL for the EU region, + MAIL_FROM).
 * E-mail is a notification, never a step of a transaction: the record is written first, sending
 * is best-effort and a failure is logged, not returned. Without configuration nothing is sent.
 */

export interface Mail {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
}

export function mailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN);
}

/** Sends one message; resolves to whether Mailgun accepted it. Never throws. */
export async function sendMail(mail: Mail, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const recipients = (Array.isArray(mail.to) ? mail.to : mail.to.split(",")).map((s) => s.trim()).filter(Boolean);
  if (!mailConfigured(env) || recipients.length === 0) {
    if (!mailConfigured(env)) console.warn(`mail: not configured, "${mail.subject}" not sent`);
    return false;
  }
  // https://documentation.mailgun.com — POST /v3/{domain}/messages, Basic auth `api:<key>`, form fields.
  const form = new FormData();
  form.append("from", env.MAIL_FROM || `Orochia <no-reply@${env.MAILGUN_DOMAIN}>`);
  for (const to of recipients) form.append("to", to);
  if (mail.replyTo) form.append("h:Reply-To", mail.replyTo);
  form.append("subject", mail.subject);
  form.append("text", mail.text);
  const base = (env.MAILGUN_API_URL || "https://api.mailgun.net").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/v3/${encodeURIComponent(env.MAILGUN_DOMAIN!)}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64")}` },
      body: form,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`mail: mailgun refused (${res.status}) ${(await res.text()).slice(0, 300)}`);
    return res.ok;
  } catch (error) {
    console.error("mail: mailgun unreachable", error);
    return false;
  }
}
