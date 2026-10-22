import type { Prisma } from "@prisma/client";
import { formatInvoiceNumber, gstOn } from "@/lib/memberships";

// Raises a one-off invoice inside a transaction (charges, locker rent). Returns the invoice id.
export async function raiseCharge(tx: Prisma.TransactionClient, gymId: string, memberId: string, description: string, amountPaise: number, withGst: boolean) {
  const gym = await tx.gym.update({ where: { id: gymId }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true, gstPercent: true } });
  const pct = withGst ? gym.gstPercent : 0;
  const gstPaise = gstOn(amountPaise, pct);
  const inv = await tx.invoice.create({
    data: { gymId, memberId, number: formatInvoiceNumber(gym.invoiceSeq, new Date().getFullYear()), subtotalPaise: amountPaise, gstPercent: pct, gstPaise, totalPaise: amountPaise + gstPaise, dueDate: new Date(), notes: description },
    select: { id: true },
  });
  return inv.id;
}
