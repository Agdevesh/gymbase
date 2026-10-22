import { randomInt } from "node:crypto";

// Members sign in with phone + a 6-digit PIN that reception hands them (WhatsApp); they can change it later.
export const newPin = () => String(randomInt(100000, 999999));
export const memberLoginEmail = (code: string, slug: string) => `${code.toLowerCase()}@${slug}.member`;

export const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

export function pinMessage(gymName: string, memberName: string, gymSlug: string, phone: string, pin: string, base: string) {
  return `Hi ${memberName}, your ${gymName} member login is ready.\nOpen ${base}/login\nGym code: ${gymSlug}\nPhone: ${phone}\nPIN: ${pin}\nYou can see your plan, dues and invoices there.`;
}

export const daysLeft = (end: Date, now: Date) => Math.ceil((end.getTime() - now.getTime()) / 86400_000);
