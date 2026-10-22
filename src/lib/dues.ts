import { DAY, dayStart } from "@/lib/dashboard";
import { paise } from "@/lib/payments";

export type DueInvoice = { id: string; number: string; totalPaise: number; paidPaise: number; dueDate: Date | null; issuedAt: Date };

export const dueOn = (i: { dueDate: Date | null; issuedAt: Date }) => i.dueDate ?? i.issuedAt;
export const dueAmount = (i: { totalPaise: number; paidPaise: number }) => Math.max(0, i.totalPaise - i.paidPaise);

// Days past the due date, 0 on the due day itself.
export const daysOverdue = (i: { dueDate: Date | null; issuedAt: Date }, now: Date) => Math.max(0, Math.floor((dayStart(now).getTime() - dayStart(dueOn(i)).getTime()) / DAY));

// "today": due today; "overdue": past due; "upcoming": not yet due.
export function dueBucket(i: { dueDate: Date | null; issuedAt: Date }, now: Date): "today" | "overdue" | "upcoming" {
  const d = dayStart(dueOn(i)).getTime(), t = dayStart(now).getTime();
  return d === t ? "today" : d < t ? "overdue" : "upcoming";
}

// Invoices whose due date is at least `days` full days ago qualify for auto-suspension.
export const suspendCutoff = (now: Date, days: number) => new Date(dayStart(now).getTime() - days * DAY);

export const suspendReason = (days: number) => `Dues unpaid for more than ${days} days`;

export function duesReminderText(name: string, gym: string, amountPaise: number, days: number, upiId: string | null) {
  const when = days === 0 ? "due today" : `overdue by ${days} day${days === 1 ? "" : "s"}`;
  return `Hi ${name}, your ${gym} payment of ${paise(amountPaise)} is ${when}. ${upiId ? `Pay on UPI: ${upiId}. ` : ""}Reply here once paid. Thank you!`;
}

export const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
