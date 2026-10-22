import { z } from "zod";

export const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK", "OTHER"] as const;
export const METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", BANK: "Bank transfer", OTHER: "Other" };

export const rupees = z.string().transform((v, ctx) => {
  const n = Number(v.replace(/[,\s₹]/g, ""));
  if (!Number.isFinite(n) || n <= 0) { ctx.addIssue({ code: "custom", message: "Enter an amount in rupees" }); return 0; }
  return Math.round(n * 100);
});

export const collectInput = z.object({
  amountPaise: rupees,
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(80).transform((v) => v || null),
  invoiceId: z.string().optional().transform((v) => v || null),
});

export const chargeInput = z.object({
  description: z.string().trim().min(1, "Describe the charge").max(120),
  amountPaise: rupees,
  gst: z.string().optional().transform((v) => v === "on"),
});

export const refundInput = z.object({
  amountPaise: rupees,
  method: z.enum(PAYMENT_METHODS),
  reason: z.string().trim().min(1, "Give a reason").max(200),
});

export const closingInput = z.object({
  date: z.iso.date("Pick a date"),
  countedPaise: z.string().transform((v) => { const n = Number(v.replace(/[,\s₹]/g, "")); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : -1; }).refine((n) => n >= 0, "Enter the cash counted"),
  notes: z.string().trim().max(500).transform((v) => v || null),
});

export type OpenInvoice = { id: string; totalPaise: number; paidPaise: number };

// Oldest invoice first; a payment larger than all dues is rejected rather than held as credit.
export function allocatePayment(amountPaise: number, invoices: OpenInvoice[]): { invoiceId: string; amountPaise: number }[] | null {
  const out: { invoiceId: string; amountPaise: number }[] = [];
  let left = amountPaise;
  for (const inv of invoices) {
    if (left <= 0) break;
    const due = inv.totalPaise - inv.paidPaise;
    if (due <= 0) continue;
    const take = Math.min(due, left);
    out.push({ invoiceId: inv.id, amountPaise: take });
    left -= take;
  }
  return left > 0 ? null : out;
}

export const outstanding = (invoices: { totalPaise: number; paidPaise: number }[]) => invoices.reduce((s, i) => s + Math.max(0, i.totalPaise - i.paidPaise), 0);

export const daysSince = (d: Date, now: Date) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400_000));

export const paise = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const localDateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
