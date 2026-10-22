// Pluggable outbound messaging. Each channel reads its provider from env; an unconfigured channel
// fails loudly so the reminder is marked FAILED and reception can still send it by hand from /reminders.
//   WhatsApp: Meta Cloud API    WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
//   SMS:      Twilio            TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
//   Email:    Resend            RESEND_API_KEY, EMAIL_FROM
import type { ReminderChannel } from "@prisma/client";

export type SendResult = { ok: true; providerRef: string | null } | { ok: false; error: string };

async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return { ok: false, error: "WhatsApp provider not configured (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID)" };
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "text", text: { body } }),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string } };
  return res.ok ? { ok: true, providerRef: json.messages?.[0]?.id ?? null } : { ok: false, error: json.error?.message ?? `WhatsApp API ${res.status}` };
}

async function sendSms(to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return { ok: false, error: "SMS provider not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)" };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  return res.ok ? { ok: true, providerRef: json.sid ?? null } : { ok: false, error: json.message ?? `Twilio ${res.status}` };
}

async function sendEmail(to: string, body: string, subject: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: "Email provider not configured (RESEND_API_KEY, EMAIL_FROM)" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text: body }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  return res.ok ? { ok: true, providerRef: json.id ?? null } : { ok: false, error: json.message ?? `Resend ${res.status}` };
}

export function sendMessage(channel: ReminderChannel, to: string, body: string, subject = "Message from your gym"): Promise<SendResult> {
  if (channel === "WHATSAPP") return sendWhatsApp(to, body);
  if (channel === "SMS") return sendSms(to, body);
  return sendEmail(to, body, subject);
}

export const configuredChannels = () => ({
  WHATSAPP: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
  SMS: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM),
  EMAIL: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
});
