"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { UPI_REQUEST_MINUTES, alertFromBody, matchAlert, newRequestCode, newToken, parseBankAlert, utrInput } from "@/lib/upi";
import { requireTenant } from "@/server/tenant";
import { requireMember } from "@/server/portal";
import { audit } from "@/server/audit";
import type { FormState } from "@/server/members";

type Tx = Prisma.TransactionClient;
const rsFmt = (p: number) => `Rs ${(p / 100).toLocaleString("en-IN")}`;

function refresh(r: { invoiceId: string; memberId: string }) {
  revalidatePath(`/invoices/${r.invoiceId}`);
  revalidatePath(`/invoices/${r.invoiceId}/upi`);
  revalidatePath(`/members/${r.memberId}`);
  revalidatePath("/payments/upi");
  revalidatePath("/defaulters");
  revalidatePath("/me");
}

// One open request per invoice; reused while it is still pending for the same due amount.
async function openRequest(gymId: string, invoiceId: string, createdById: string | null, memberId?: string) {
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, gymId, ...(memberId && { memberId }) }, include: { gym: { select: { upiId: true } } } });
  if (!inv) return { error: "Invoice not found" };
  if (!inv.gym.upiId) return { error: "Add the gym's UPI ID under Settings first." };
  const due = inv.totalPaise - inv.paidPaise;
  if (due <= 0) return { error: "Nothing is due on this invoice." };
  const now = new Date();
  const existing = await db.upiRequest.findFirst({ where: { invoiceId, status: "PENDING", expiresAt: { gt: now }, amountPaise: due }, orderBy: { createdAt: "desc" } });
  if (existing) return { request: existing };
  await db.upiRequest.updateMany({ where: { invoiceId, status: "PENDING" }, data: { status: "CANCELLED" } });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const request = await db.upiRequest.create({ data: { gymId, invoiceId, memberId: inv.memberId, amountPaise: due, code: newRequestCode(), token: newToken(), createdById, expiresAt: new Date(now.getTime() + UPI_REQUEST_MINUTES * 60_000) } });
      return { request };
    } catch (e) {
      if (attempt === 4) throw e; // code collision is a 1-in-a-billion retry
    }
  }
  return { error: "Could not create request" };
}

// Reception: show the fixed-amount QR for an invoice.
export async function startUpiRequest(invoiceId: string): Promise<FormState> {
  const { gymId, userId } = await requireTenant("payments:write");
  const r = await openRequest(gymId, invoiceId, userId);
  if ("error" in r) return { message: r.error };
  redirect(`/invoices/${invoiceId}/upi`);
}

// Member portal: the member opens their own pay page.
export async function startMemberUpiRequest(invoiceId: string) {
  const { member, gym } = await requireMember();
  const r = await openRequest(gym.id, invoiceId, null, member.id);
  if ("error" in r) redirect(`/me?upi=${encodeURIComponent(r.error ?? "Could not start payment")}`);
  redirect(`/pay/${r.request.token}`);
}

export async function cancelUpiRequest(id: string) {
  const { gymId, userId } = await requireTenant("payments:write");
  const r = await db.upiRequest.findFirst({ where: { id, gymId, status: "PENDING" } });
  if (!r) return;
  await db.upiRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(gymId, userId, "upi.cancel", "invoice", r.invoiceId, `Cancelled UPI request ${r.code}`);
  refresh(r);
  redirect(`/invoices/${r.invoiceId}`);
}

// Records the payment against the invoice and closes the request; the caller has already verified the alert belongs to it.
async function settle(tx: Tx, request: { id: string; gymId: string; invoiceId: string; memberId: string; amountPaise: number; createdById: string | null }, alertId: string, utr: string | null, byUserId: string | null) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: request.invoiceId }, select: { totalPaise: true, paidPaise: true } });
  const amount = Math.min(request.amountPaise, inv.totalPaise - inv.paidPaise);
  if (amount <= 0) throw new Error("Invoice already settled");
  const payment = await tx.payment.create({ data: { gymId: request.gymId, memberId: request.memberId, invoiceId: request.invoiceId, method: "UPI", amountPaise: amount, reference: utr, takenById: byUserId ?? request.createdById } });
  await tx.invoice.update({ where: { id: request.invoiceId }, data: { paidPaise: { increment: amount } } });
  await tx.upiRequest.update({ where: { id: request.id }, data: { status: "PAID", utr, paymentId: payment.id, paidAt: new Date() } });
  await tx.bankAlert.update({ where: { id: alertId }, data: { requestId: request.id, note: null } });
  return payment;
}

const pendingWhere = (gymId: string) => ({ gymId, status: "PENDING" as const, expiresAt: { gt: new Date() } });

export type AlertOutcome = { ok: true; matched: boolean; requestId?: string; amountPaise?: number; note?: string; duplicate?: boolean } | { ok: false; error: string };

// Webhook path: a bank SMS/notification forwarded by the owner's phone. Never throws on bad input; always stores what arrived.
export async function recordBankAlert(gymId: string, body: unknown, contentType: string, source: "SMS" | "EMAIL" = "SMS"): Promise<AlertOutcome> {
  const incoming = alertFromBody(body, contentType);
  if (!incoming) return { ok: false, error: "No message text found; send JSON like {\"from\":\"AX-SBIINB\",\"text\":\"...\"}" };
  const parsed = parseBankAlert(incoming.text);
  if (!parsed) return { ok: true, matched: false, note: "Not a credit alert; ignored" };
  if (parsed.utr) {
    const dup = await db.bankAlert.findUnique({ where: { gymId_utr: { gymId, utr: parsed.utr } }, select: { id: true, requestId: true } });
    if (dup) return { ok: true, matched: !!dup.requestId, duplicate: true, requestId: dup.requestId ?? undefined, note: "Already received" };
  }
  const pending = await db.upiRequest.findMany({ where: pendingWhere(gymId), orderBy: { createdAt: "asc" } });
  const m = matchAlert({ amountPaise: parsed.amountPaise, text: incoming.text }, pending);
  const note = !m ? `No pending request for ${rsFmt(parsed.amountPaise)}` : "ambiguous" in m ? `${m.ambiguous.length} requests waiting for ${rsFmt(parsed.amountPaise)}; pick one` : null;
  const alert = await db.bankAlert.create({ data: { gymId, source, sender: incoming.sender?.slice(0, 60), text: incoming.text.slice(0, 2000), amountPaise: parsed.amountPaise, utr: parsed.utr, payerVpa: parsed.payerVpa, note } });
  if (!m || "ambiguous" in m) return { ok: true, matched: false, amountPaise: parsed.amountPaise, note: note ?? undefined };
  const request = pending.find((p) => p.id === m.request.id)!;
  await db.$transaction((tx) => settle(tx, request, alert.id, parsed.utr, null));
  await audit(gymId, null, "payment.upi_auto", "invoice", request.invoiceId, `UPI ${rsFmt(request.amountPaise)} verified from bank alert${parsed.utr ? ` (UTR ${parsed.utr})` : ""}`);
  refresh(request);
  return { ok: true, matched: true, requestId: request.id, amountPaise: parsed.amountPaise };
}

// Reception types the UTR from the member's phone screen; the same UTR can never clear two dues.
export async function confirmUpiByUtr(requestId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("payments:write");
  const utr = utrInput(String(formData.get("utr") ?? ""));
  if (!utr) return { errors: { utr: "UTR / UPI ref is 12 digits (10–22 characters allowed)" } };
  const request = await db.upiRequest.findFirst({ where: { id: requestId, gymId, status: "PENDING" } });
  if (!request) return { message: "This request is no longer open." };
  const [dupAlert, dupPayment] = await Promise.all([
    db.bankAlert.findUnique({ where: { gymId_utr: { gymId, utr } }, select: { requestId: true } }),
    db.payment.findFirst({ where: { gymId, reference: utr }, select: { id: true } }),
  ]);
  if ((dupAlert && dupAlert.requestId) || dupPayment) return { errors: { utr: "This UTR was already used for another payment." } };
  await db.$transaction(async (tx) => {
    const alert = dupAlert
      ? await tx.bankAlert.findUniqueOrThrow({ where: { gymId_utr: { gymId, utr } } })
      : await tx.bankAlert.create({ data: { gymId, source: "MANUAL", text: `UTR ${utr} entered at reception`, amountPaise: request.amountPaise, utr } });
    await settle(tx, request, alert.id, utr, userId);
  });
  await audit(gymId, userId, "payment.upi_utr", "invoice", request.invoiceId, `UPI ${rsFmt(request.amountPaise)} confirmed by UTR ${utr}`);
  refresh(request);
  return {};
}

// An unmatched alert (several requests for the same amount) is attached by hand.
export async function assignAlert(alertId: string, requestId: string) {
  const { gymId, userId } = await requireTenant("payments:write");
  const [alert, request] = await Promise.all([
    db.bankAlert.findFirst({ where: { id: alertId, gymId, requestId: null } }),
    db.upiRequest.findFirst({ where: { id: requestId, gymId, status: "PENDING" } }),
  ]);
  if (!alert || !request) return;
  if (alert.amountPaise !== request.amountPaise) return;
  await db.$transaction((tx) => settle(tx, request, alert.id, alert.utr, userId));
  await audit(gymId, userId, "payment.upi_assign", "invoice", request.invoiceId, `UPI ${rsFmt(request.amountPaise)} matched by hand${alert.utr ? ` (UTR ${alert.utr})` : ""}`);
  refresh(request);
}

export async function regenerateUpiAlertToken() {
  const { gymId, userId } = await requireTenant("gym:manage");
  await db.gym.update({ where: { id: gymId }, data: { upiAlertToken: newToken() } });
  await audit(gymId, userId, "settings.upi_token", "gym", gymId, "New bank-alert webhook link");
  revalidatePath("/settings/upi");
}

// Daily cron: close requests nobody paid.
export async function expireUpiRequests() {
  const r = await db.upiRequest.updateMany({ where: { status: "PENDING", expiresAt: { lte: new Date() } }, data: { status: "EXPIRED" } });
  return r.count;
}
