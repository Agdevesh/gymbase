export const DAY = 86400_000;
export const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const shortDay = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2);

// Sums signed payment amounts into one bucket per local day for the last `days` days (oldest first).
export function bucketByDay(payments: { paidAt: Date; amountPaise: number; kind: string }[], now: Date, days: number) {
  const start = dayStart(now).getTime() - (days - 1) * DAY;
  const out = Array.from({ length: days }, (_, i) => ({ date: new Date(start + i * DAY), total: 0 }));
  for (const p of payments) {
    const i = Math.floor((dayStart(p.paidAt).getTime() - start) / DAY);
    if (i >= 0 && i < days) out[i].total += p.kind === "REFUND" ? -p.amountPaise : p.amountPaise;
  }
  return out;
}

export const conversionRate = (converted: number, total: number) => (total === 0 ? 0 : Math.round((converted / total) * 100));

export const signedTotal = (payments: { amountPaise: number; kind: string }[]) => payments.reduce((s, p) => s + (p.kind === "REFUND" ? -p.amountPaise : p.amountPaise), 0);
