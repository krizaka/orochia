import { appUrl } from "./env";
import { type MailLocale, type MailTemplateId, type MailVars, renderMailTemplate } from "./mail-templates";

/**
 * Transactional e-mail, from the sending subdomain mg.orochia.com (MAIL_FROM):
 *   RESEND_API_KEY                         the Resend API — used when set
 *   MAILGUN_API_KEY + MAILGUN_DOMAIN       the Mailgun HTTP API otherwise (+ MAILGUN_API_URL for the EU region)
 * E-mail is a notification, never a step of a transaction: the record is written first, sending
 * is best-effort and a failure is logged, not returned. Without configuration nothing is sent.
 * Every message is a template (`sendTemplate`, lib/mail-templates.ts, apps/web/mail-templates/): no body in code.
 */

export interface Mail {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

/**
 * Whether messages really leave: always in production; elsewhere only with MAIL_DELIVERY=on — local runs and
 * test suites write the message to the log instead, so seed and test addresses never receive real e-mail.
 */
export function mailDeliveryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" || env.MAIL_DELIVERY === "on";
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
    body: JSON.stringify({ from: fromAddress(env), to: recipients, subject: mail.subject, text: mail.text, ...(mail.html ? { html: mail.html } : {}), ...(mail.replyTo ? { reply_to: mail.replyTo } : {}) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) console.error(`mail: resend refused (${res.status}) ${(await res.text()).slice(0, 300)}`);
  return res.ok;
}

/** Sends one message; resolves to whether Mailgun accepted it. Never throws. */
export async function sendMail(mail: Mail, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const recipients = (Array.isArray(mail.to) ? mail.to : mail.to.split(",")).map((s) => s.trim()).filter(Boolean);
  if (!mailDeliveryEnabled(env)) {
    console.info(`mail (not delivered outside production — MAIL_DELIVERY=on to send) to ${recipients.join(", ")}: ${mail.subject}\n${mail.text}`);
    return false;
  }
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
  if (mail.html) form.append("html", mail.html);
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

export interface TemplateMail<Id extends MailTemplateId> {
  to: string | string[];
  /** The recipient's language; English when absent or not translated. */
  locale?: MailLocale;
  vars: MailVars<Id>;
  replyTo?: string;
}

/**
 * Renders a template (subject, HTML and plain text, in the shared layout) and sends it. Never throws: a template that
 * cannot be rendered is logged and nothing is sent.
 */
export async function sendTemplate<Id extends MailTemplateId>(id: Id, mail: TemplateMail<Id>, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  let rendered;
  try {
    rendered = await renderMailTemplate(id, mail.vars, { locale: mail.locale, appUrl: appUrl(), env });
  } catch (error) {
    console.error(`mail: template ${id} could not be rendered, nothing sent`, error);
    return false;
  }
  return sendMail({ to: mail.to, replyTo: mail.replyTo, subject: rendered.subject, text: rendered.text, html: rendered.html }, env);
}
