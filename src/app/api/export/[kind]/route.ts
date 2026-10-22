import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/settings";
import { audit } from "@/server/audit";
import { requireTenant } from "@/server/tenant";

const KINDS = ["members", "memberships", "payments", "invoices", "leads", "expenses"] as const;
const rs = (p: number) => (p / 100).toFixed(2);
const name = (m: { firstName: string; lastName: string | null }) => [m.firstName, m.lastName].filter(Boolean).join(" ");
const dt = (d: Date | null) => (d ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }) : "");

// Owner-only CSV export of the gym's data. Reads are allowed even when the subscription is locked.
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { gymId, userId } = await requireTenant("gym:manage", { skipSubscriptionCheck: true });
  const { kind } = await params;
  if (!(KINDS as readonly string[]).includes(kind)) return new NextResponse("Unknown export", { status: 404 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from"), to = url.searchParams.get("to");
  const range = from || to ? { ...(from && { gte: new Date(from) }), ...(to && { lt: new Date(new Date(to).getTime() + 86400_000) }) } : undefined;
  let headers: string[] = [], rows: (string | number | null | Date)[][] = [];

  if (kind === "members") {
    const ms = await db.member.findMany({ where: { gymId }, orderBy: { code: "asc" }, include: { memberships: { orderBy: { endDate: "desc" }, take: 1, include: { plan: true } }, invoices: { select: { totalPaise: true, paidPaise: true } } } });
    headers = ["Code", "Name", "Phone", "Email", "Gender", "DOB", "Joined", "Usual time", "Plan", "Status", "Plan ends", "Dues (Rs)", "Address", "Emergency contact", "Emergency phone", "Notes"];
    rows = ms.map((m) => { const c = m.memberships[0]; return [m.code, name(m), m.phone, m.email, m.gender, m.dob, m.joinedAt, m.usualTime, c?.plan.name ?? "", c?.status ?? "NO_PLAN", c?.endDate ?? null, rs(m.invoices.reduce((s, i) => s + Math.max(0, i.totalPaise - i.paidPaise), 0)), m.address, m.emergencyName, m.emergencyPhone, m.notes]; });
  } else if (kind === "memberships") {
    const ms = await db.membership.findMany({ where: { gymId, ...(range && { startDate: range }) }, orderBy: { startDate: "desc" }, include: { member: true, plan: true } });
    headers = ["Member code", "Member", "Phone", "Plan", "Start", "End", "Status", "Price (Rs)", "Discount (Rs)", "Frozen days", "Cancel reason"];
    rows = ms.map((m) => [m.member.code, name(m.member), m.member.phone, m.plan.name, m.startDate, m.endDate, m.status, rs(m.pricePaise), rs(m.discountPaise), m.frozenDays, m.cancelReason]);
  } else if (kind === "payments") {
    const ps = await db.payment.findMany({ where: { gymId, ...(range && { paidAt: range }) }, orderBy: { paidAt: "desc" }, include: { member: true, invoice: { select: { number: true } }, takenBy: { select: { name: true } } } });
    headers = ["Date", "Member code", "Member", "Phone", "Invoice", "Type", "Method", "Amount (Rs)", "Reference", "Taken by"];
    rows = ps.map((p) => [dt(p.paidAt), p.member.code, name(p.member), p.member.phone, p.invoice?.number ?? "", p.kind, p.method, rs(p.amountPaise), p.reference, p.takenBy?.name ?? ""]);
  } else if (kind === "invoices") {
    const is = await db.invoice.findMany({ where: { gymId, ...(range && { issuedAt: range }) }, orderBy: { issuedAt: "desc" }, include: { member: true, membership: { include: { plan: true } } } });
    headers = ["Invoice", "Date", "Member code", "Member", "Phone", "Item", "Subtotal (Rs)", "GST %", "GST (Rs)", "Total (Rs)", "Paid (Rs)", "Due (Rs)"];
    rows = is.map((i) => [i.number, i.issuedAt, i.member.code, name(i.member), i.member.phone, i.membership ? `${i.membership.plan.name} membership` : i.notes ?? "Charge", rs(i.subtotalPaise), i.gstPercent, rs(i.gstPaise), rs(i.totalPaise), rs(i.paidPaise), rs(Math.max(0, i.totalPaise - i.paidPaise))]);
  } else if (kind === "expenses") {
    const es = await db.expense.findMany({ where: { gymId, ...(range && { paidAt: range }) }, orderBy: { paidAt: "desc" }, include: { createdBy: { select: { name: true } } } });
    headers = ["Date", "Category", "Amount (Rs)", "Paid by", "Paid to", "Notes", "Added by"];
    rows = es.map((e) => [e.paidAt, e.category, rs(e.amountPaise), e.method, e.vendor, e.notes, e.createdBy?.name ?? ""]);
  } else {
    const ls = await db.lead.findMany({ where: { gymId, ...(range && { createdAt: range }) }, orderBy: { createdAt: "desc" }, include: { owner: { select: { name: true } } } });
    headers = ["Created", "Name", "Phone", "Email", "Source", "Status", "Interested in", "Follow-up", "Owner", "Lost reason", "Notes"];
    rows = ls.map((l) => [l.createdAt, l.name, l.phone, l.email, l.source, l.status, l.interestedIn, l.followUpAt, l.owner?.name ?? "", l.lostReason, l.notes]);
  }
  await audit(gymId, userId, "export.csv", kind, null, `Exported ${kind} (${rows.length} rows)`);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(headers, rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="gymbase-${kind}-${stamp}.csv"` } });
}
