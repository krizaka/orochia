/**
 * Transactional e-mail, from the sending subdomain mg.orochia.com (MAIL_FROM):
 *   RESEND_API_KEY                         the Resend API — used when set
 *   MAILGUN_API_KEY + MAILGUN_DOMAIN       the Mailgun HTTP API otherwise (+ MAILGUN_API_URL for the EU region)
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
  return Boolean(env.RESEND_API_KEY || (env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN));
}

const fromAddress = (env: NodeJS.ProcessEnv) => env.MAIL_FROM || `Orochia <no-reply@${env.MAILGUN_DOMAIN || "mg.orochia.com"}>`;

/** https://resend.com/docs/api-reference/emails/send-email */
async function sendWithResend(mail: Mail, recipients: string[], env: NodeJS.ProcessEnv): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromAddress(env), to: recipients, subject: mail.subject, text: mail.text, ...(mail.replyTo ? { reply_to: mail.replyTo } : {}) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) console.error(`mail: resend refused (${res.status}) ${(await res.text()).slice(0, 300)}`);
  return res.ok;
}

/** Sends one message; resolves to whether Mailgun accepted it. Never throws. */
export async function sendMail(mail: Mail, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const recipients = (Array.isArray(mail.to) ? mail.to : mail.to.split(",")).map((s) => s.trim()).filter(Boolean);
  if (!mailConfigured(env) || recipients.length === 0) {
    if (!mailConfigured(env)) console.warn(`mail: not configured, "${mail.subject}" not sent`);
    return false;
  }
  if (env.RESEND_API_KEY) {
    try {
      return await sendWithResend(mail, recipients, env);
    } catch (error) {
      console.error("mail: resend unreachable", error);
      return false;
    }
  }
  // https://documentation.mailgun.com — POST /v3/{domain}/messages, Basic auth `api:<key>`, form fields.
  const form = new FormData();
  form.append("from", fromAddress(env));
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
