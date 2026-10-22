import { randomBytes, randomInt } from "node:crypto";

// Fixed-amount UPI collect request: the QR carries the exact amount (am=) plus a short per-request code in the
// note (tn=) and reference (tr=), so a member paying ₹600 against ₹700 never matches and the desk sees it at once.

export const UPI_REQUEST_MINUTES = 30;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion when read out loud
export const newRequestCode = () => "GB" + Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
export const newToken = () => randomBytes(16).toString("hex");

export function upiPayUri(o: { upiId: string; payee: string; amountPaise: number; code: string; note?: string }) {
  const q = new URLSearchParams({ pa: o.upiId, pn: o.payee.slice(0, 50), am: (o.amountPaise / 100).toFixed(2), cu: "INR", tn: `${o.code}${o.note ? " " + o.note : ""}`.slice(0, 50), tr: o.code });
  return `upi://pay?${q.toString()}`;
}

export type ParsedAlert = { amountPaise: number; utr: string | null; payerVpa: string | null };

const money = String.raw`(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)`;

// Reads a bank or UPI app credit SMS/notification. Returns null for anything that is not an incoming credit.
export function parseBankAlert(raw: string): ParsedAlert | null {
  const text = raw.replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!text) return null;
  const creditAt = text.search(/\b(credited|received|deposited|added to your|transferred to your|payment of .{1,40}? (?:has been )?made to your)\b/i);
  const debitAt = text.search(/\b(debited|withdrawn|deducted|sent|paid to|spent)\b/i);
  if (creditAt === -1 || (debitAt !== -1 && debitAt < creditAt)) return null;
  // Balances must never be mistaken for the credit amount.
  const noBal = text.replace(new RegExp(String.raw`\b(?:avl|avail|available|total|ledger|clear|curr|current)?\s*(?:bal|balance|limit)\b[\s:is-]*${money}`, "gi"), " ");
  const amt = noBal.match(new RegExp(String.raw`(?:credited|received|deposited)\s*(?:with|by|for|of)?\s*(?::|-)?\s*${money}`, "i"))
    ?? noBal.match(new RegExp(`${money}\\s*(?:has been |is |was )?(?:credited|received|deposited)`, "i"))
    ?? noBal.match(new RegExp(money, "i"))
    ?? noBal.match(/\b(\d{1,7}\.\d{2})\b/);
  if (!amt) return null;
  const amountPaise = Math.round(Number(amt[1].replace(/,/g, "")) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) return null;
  const utr = text.match(/\b(?:upi\s*ref(?:erence)?(?:\s*no\.?)?|utr(?:\s*no\.?)?|rrn|ref(?:erence)?\s*(?:no\.?|id)?|txn\s*(?:id|no\.?)?|transaction\s*id)\s*[:#.-]?\s*([A-Za-z0-9]{10,22})\b/i)?.[1]
    ?? text.match(/\b(\d{12})\b/)?.[1] ?? null;
  const payerVpa = text.match(/(?:from|by|vpa|upi\s*id)\s*:?\s*(?:[a-z][a-z .]{0,40}\()?([a-z0-9._-]{2,64}@[a-z0-9.-]{2,32})/i)?.[1]?.replace(/[.,;]+$/, "").toLowerCase() ?? null;
  return { amountPaise, utr: utr ? utr.toUpperCase() : null, payerVpa };
}

export const utrInput = (s: string) => {
  const v = s.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{10,22}$/.test(v) ? v : null;
};

export type PendingLike = { id: string; amountPaise: number; code: string; createdAt: Date };

// Exact amount wins; among equal amounts the code in the alert text decides; otherwise one candidate must be unique.
export function matchAlert(alert: { amountPaise: number; text: string }, pending: PendingLike[]): { request: PendingLike } | { ambiguous: PendingLike[] } | null {
  const same = pending.filter((p) => p.amountPaise === alert.amountPaise);
  if (same.length === 0) return null;
  if (same.length === 1) return { request: same[0] };
  const upper = alert.text.toUpperCase();
  const byCode = same.filter((p) => upper.includes(p.code.toUpperCase()));
  if (byCode.length === 1) return { request: byCode[0] };
  return { ambiguous: same };
}

// Body shapes posted by the common free Android SMS-forwarder apps, or a plain string.
export function alertFromBody(body: unknown, contentType: string): { text: string; sender: string | null } | null {
  if (typeof body === "string") return body.trim() ? { text: body, sender: null } : null;
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const pick = (...keys: string[]) => { for (const k of keys) { const v = b[k]; if (typeof v === "string" && v.trim()) return v; } return null; };
  const text = pick("text", "message", "body", "msg", "sms", "content", "notification");
  if (!text) return null;
  void contentType;
  return { text, sender: pick("from", "sender", "address", "number", "app") };
}
