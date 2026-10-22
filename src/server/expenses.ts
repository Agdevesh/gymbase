"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checkUpload } from "@/lib/members";
import { expenseInput } from "@/lib/reports";
import { audit } from "@/server/audit";
import { requireTenant } from "@/server/tenant";
import type { FormState } from "@/server/members";

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function addExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("payments:write");
  const parsed = expenseInput.safeParse(Object.fromEntries(["category", "amountPaise", "paidAt", "method", "vendor", "notes"].map((k) => [k, str(formData, k)])));
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const receipt = formData.get("receipt");
  const hasReceipt = receipt instanceof File && receipt.size > 0;
  const err = hasReceipt ? checkUpload(receipt, "document") : null;
  if (err) return { errors: { receipt: err } };
  await db.$transaction(async (tx) => {
    const receiptId = hasReceipt ? (await tx.storedFile.create({ data: { gymId, name: receipt.name, mime: receipt.type, size: receipt.size, data: Buffer.from(await receipt.arrayBuffer()) }, select: { id: true } })).id : null;
    await tx.expense.create({ data: { ...parsed.data, gymId, receiptId, createdById: userId } });
  });
  await audit(gymId, userId, "expense.add", "expense", null, `Expense ${parsed.data.category.toLowerCase()} Rs ${parsed.data.amountPaise / 100}${parsed.data.vendor ? ` to ${parsed.data.vendor}` : ""}`);
  revalidatePath("/expenses");
  revalidatePath("/reports");
  return {};
}

export async function deleteExpense(id: string) {
  const { gymId, userId } = await requireTenant("gym:manage");
  const e = await db.expense.findFirst({ where: { id, gymId }, select: { amountPaise: true, category: true, receiptId: true } });
  if (!e) return;
  await db.$transaction([db.expense.delete({ where: { id } }), ...(e.receiptId ? [db.storedFile.deleteMany({ where: { id: e.receiptId, gymId } })] : [])]);
  await audit(gymId, userId, "expense.delete", "expense", id, `Deleted expense ${e.category.toLowerCase()} Rs ${e.amountPaise / 100}`);
  revalidatePath("/expenses");
  revalidatePath("/reports");
}
