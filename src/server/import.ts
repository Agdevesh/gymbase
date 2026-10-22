"use server";

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { formatMemberCode } from "@/lib/members";
import { parseCsv, parseRows, type ImportRow } from "@/lib/import";
import { formatInvoiceNumber } from "@/lib/memberships";
import { audit } from "@/server/audit";
import { requireTenant } from "@/server/tenant";

export type ImportState = { error?: string; preview?: { rows: ImportRow[]; plans: string[]; csv: string }; result?: { created: number; skipped: number; memberships: number; failed: string[] } } | undefined;

async function readCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file" };
  if (file.size > 4 * 1024 * 1024) return { error: "File is larger than 4 MB; split it" };
  if (/\.xlsx?$/i.test(file.name)) return { error: "Open the file in Excel and use File → Save As → CSV (comma delimited), then upload that." };
  return { csv: await file.text() };
}

export async function previewImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { gymId } = await requireTenant("members:write");
  const r = await readCsv(formData);
  if (r.error || !r.csv) return { error: r.error };
  const parsed = parseRows(parseCsv(r.csv));
  if (parsed.unknownHeader) return { error: "Could not find a 'name' and 'phone' column in the first row. Download the template and match its headings." };
  if (parsed.rows.length > 2000) return { error: "Up to 2,000 rows per file; split the sheet." };
  const plans = await db.plan.findMany({ where: { gymId, active: true }, select: { name: true } });
  return { preview: { rows: parsed.rows, plans: plans.map((p) => p.name), csv: r.csv } };
}

// Imports valid rows: member (skipped if the phone exists), optional membership by plan name, invoice marked paid.
export async function runImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { gymId, userId } = await requireTenant("members:write");
  const csv = String(formData.get("csv") ?? "");
  const parsed = parseRows(parseCsv(csv));
  if (parsed.unknownHeader) return { error: "Bad file" };
  const [plans, sub, existing] = await Promise.all([
    db.plan.findMany({ where: { gymId }, select: { id: true, name: true, durationDays: true, pricePaise: true } }),
    db.subscription.findUnique({ where: { gymId }, select: { memberLimit: true } }),
    db.member.count({ where: { gymId } }),
  ]);
  const planByName = new Map(plans.map((p) => [p.name.toLowerCase(), p]));
  let created = 0, skipped = 0, memberships = 0;
  const failed: string[] = [];
  for (const row of parsed.rows) {
    if (row.errors.length) { failed.push(`Line ${row.line}: ${row.errors.join(", ")}`); continue; }
    if (sub && existing + created >= sub.memberLimit) { failed.push(`Line ${row.line}: member limit of ${sub.memberLimit} reached`); continue; }
    const dup = await db.member.findUnique({ where: { gymId_phone: { gymId, phone: row.phone } }, select: { id: true } });
    if (dup) { skipped++; continue; }
    const plan = row.plan ? planByName.get(row.plan.toLowerCase()) : undefined;
    if (row.plan && !plan) failed.push(`Line ${row.line}: plan "${row.plan}" not found, member added without a plan`);
    try {
      await db.$transaction(async (tx) => {
        const gym = await tx.gym.update({ where: { id: gymId }, data: { memberSeq: { increment: 1 } }, select: { memberSeq: true } });
        const [firstName, ...rest] = row.name.split(/\s+/);
        const member = await tx.member.create({ data: { gymId, code: formatMemberCode(gym.memberSeq), qrToken: randomBytes(16).toString("hex"), firstName, lastName: rest.join(" ") || null, phone: row.phone, email: row.email, gender: row.gender, dob: row.dob, joinedAt: row.joined ?? row.start ?? new Date(), notes: row.notes }, select: { id: true } });
        if (plan && row.start) {
          const end = row.end ?? new Date(row.start.getTime() + plan.durationDays * 86400_000);
          const status = end < new Date() ? "EXPIRED" : "ACTIVE";
          const price = row.paidPaise > 0 ? row.paidPaise : plan.pricePaise;
          const ms = await tx.membership.create({ data: { gymId, memberId: member.id, planId: plan.id, startDate: row.start, endDate: end, status, pricePaise: price }, select: { id: true } });
          const g = await tx.gym.update({ where: { id: gymId }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true } });
          const inv = await tx.invoice.create({ data: { gymId, memberId: member.id, membershipId: ms.id, number: formatInvoiceNumber(g.invoiceSeq, row.start.getFullYear()), subtotalPaise: price, totalPaise: price, paidPaise: row.paidPaise, issuedAt: row.start, dueDate: row.start, notes: "Imported" }, select: { id: true } });
          if (row.paidPaise > 0) await tx.payment.create({ data: { gymId, memberId: member.id, invoiceId: inv.id, method: "OTHER", amountPaise: row.paidPaise, reference: "Imported", paidAt: row.start, takenById: userId } });
          memberships++;
        }
      });
      created++;
    } catch (e) {
      failed.push(`Line ${row.line}: ${e instanceof Error ? e.message.split("\n")[0] : "failed"}`);
    }
  }
  await audit(gymId, userId, "members.import", "member", null, `Imported ${created} members (${memberships} with plans), skipped ${skipped} existing, ${failed.length} issues`);
  return { result: { created, skipped, memberships, failed } };
}
