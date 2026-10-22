"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatInvoiceNumber, gstOn } from "@/lib/memberships";
import { allocatePayment, chargeInput, closingInput, collectInput, refundInput } from "@/lib/payments";
import { requireTenant } from "@/server/tenant";
import { audit } from "@/server/audit";
const rsFmt = (p: number) => `Rs ${(p / 100).toLocaleString("en-IN")}`;
import type { FormState } from "@/server/members";

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

function refresh(memberId: string, invoiceIds: string[] = []) {
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/defaulters");
  revalidatePath("/payments");
  for (const id of invoiceIds) revalidatePath(`/invoices/${id}`);
}

// Collects against the member's unpaid invoices, oldest first (or one invoice when invoiceId is given).
export async function collectPayment(memberId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("payments:write");
  const parsed = collectInput.safeParse({ amountPaise: str(formData, "amountPaise"), method: str(formData, "method"), reference: str(formData, "reference"), invoiceId: str(formData, "invoiceId") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const { amountPaise, method, reference, invoiceId } = parsed.data;
  const result = await db.$transaction(async (tx) => {
    const invoices = await tx.invoice.findMany({
      where: { gymId, memberId, ...(invoiceId && { id: invoiceId }) },
      orderBy: { issuedAt: "asc" },
      select: { id: true, totalPaise: true, paidPaise: true },
    });
    const alloc = allocatePayment(amountPaise, invoices);
    if (!alloc) return { errors: { amountPaise: `More than the outstanding ${((invoices.reduce((s, i) => s + i.totalPaise - i.paidPaise, 0)) / 100).toLocaleString("en-IN")}` } };
    for (const a of alloc) {
      await tx.payment.create({ data: { gymId, memberId, invoiceId: a.invoiceId, method, amountPaise: a.amountPaise, reference, takenById: userId } });
      await tx.invoice.update({ where: { id: a.invoiceId }, data: { paidPaise: { increment: a.amountPaise } } });
    }
    return { ids: alloc.map((a) => a.invoiceId) };
  });
  if ("errors" in result) return result;
  await audit(gymId, userId, "payment.collect", "member", memberId, `Collected ${rsFmt(amountPaise)} by ${method}${reference ? ` (${reference})` : ""}`);
  refresh(memberId, result.ids);
  return {};
}

// A one-off charge (registration fee, supplements, locker) raises its own invoice.
export async function addCharge(memberId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("payments:write");
  const parsed = chargeInput.safeParse({ description: str(formData, "description"), amountPaise: str(formData, "amountPaise"), gst: str(formData, "gst") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const { description, amountPaise, gst } = parsed.data;
  const id = await db.$transaction(async (tx) => {
    const member = await tx.member.findFirst({ where: { id: memberId, gymId }, select: { id: true } });
    if (!member) return null;
    const gym = await tx.gym.update({ where: { id: gymId }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true, gstPercent: true } });
    const pct = gst ? gym.gstPercent : 0;
    const gstPaise = gstOn(amountPaise, pct);
    const inv = await tx.invoice.create({
      data: { gymId, memberId, number: formatInvoiceNumber(gym.invoiceSeq, new Date().getFullYear()), subtotalPaise: amountPaise, gstPercent: pct, gstPaise, totalPaise: amountPaise + gstPaise, dueDate: new Date(), notes: description },
      select: { id: true },
    });
    return inv.id;
  });
  if (!id) return { message: "Member not found" };
  await audit(gymId, userId, "invoice.charge", "invoice", id, `Charged ${rsFmt(amountPaise)}: ${description}`);
  refresh(memberId, [id]);
  redirect(`/invoices/${id}`);
}

export async function refundPayment(paymentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("payments:refund");
  const parsed = refundInput.safeParse({ amountPaise: str(formData, "amountPaise"), method: str(formData, "method"), reason: str(formData, "reason") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const { amountPaise, method, reason } = parsed.data;
  const original = await db.payment.findFirst({ where: { id: paymentId, gymId, kind: "PAYMENT" }, include: { refunds: { select: { amountPaise: true } } } });
  if (!original) return { message: "Payment not found" };
  const refunded = original.refunds.reduce((s, r) => s + r.amountPaise, 0);
  if (amountPaise > original.amountPaise - refunded) return { errors: { amountPaise: `At most ${((original.amountPaise - refunded) / 100).toLocaleString("en-IN")} can still be refunded` } };
  await db.$transaction([
    db.payment.create({ data: { gymId, memberId: original.memberId, invoiceId: original.invoiceId, kind: "REFUND", method, amountPaise, reference: reason, takenById: userId, refundOfId: original.id } }),
    ...(original.invoiceId ? [db.invoice.update({ where: { id: original.invoiceId }, data: { paidPaise: { decrement: amountPaise } } })] : []),
  ]);
  await audit(gymId, userId, "payment.refund", "member", original.memberId, `Refunded ${rsFmt(amountPaise)} by ${method}: ${reason ?? ""}`);
  refresh(original.memberId, original.invoiceId ? [original.invoiceId] : []);
  return {};
}

// Reception counts the drawer at the end of the day; cash payments of that day get stamped with the closing.
export async function closeDay(_prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("payments:write");
  const parsed = closingInput.safeParse({ date: str(formData, "date"), countedPaise: str(formData, "countedPaise"), notes: str(formData, "notes") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const { date, countedPaise, notes } = parsed.data;
  const start = new Date(`${date}T00:00:00`), end = new Date(start.getTime() + 86400_000);
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.cashClosing.findUnique({ where: { gymId_date: { gymId, date: new Date(`${date}T00:00:00Z`) } } });
    if (existing) return { message: "This day is already closed" };
    const cash = await tx.payment.findMany({ where: { gymId, method: "CASH", closingId: null, paidAt: { gte: start, lt: end } }, select: { id: true, kind: true, amountPaise: true } });
    const expectedPaise = cash.reduce((s, p) => s + (p.kind === "REFUND" ? -p.amountPaise : p.amountPaise), 0);
    const closing = await tx.cashClosing.create({ data: { gymId, date: new Date(`${date}T00:00:00Z`), closedById: userId, expectedPaise, countedPaise, notes } });
    await tx.payment.updateMany({ where: { id: { in: cash.map((p) => p.id) } }, data: { closingId: closing.id } });
    return {};
  });
  if (!result.message) await audit(gymId, userId, "cash.close", "cashclosing", null, `Closed cash for ${date}: counted ${rsFmt(countedPaise)}`);
  revalidatePath("/payments");
  return result;
}
