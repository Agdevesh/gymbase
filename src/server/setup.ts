"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/server/tenant";

export async function dismissSetup() {
  const { gymId } = await requireTenant("gym:manage");
  await db.gym.update({ where: { id: gymId }, data: { setupDoneAt: new Date() } });
  revalidatePath("/dashboard");
  revalidatePath("/setup");
}

// The getting-started checklist, computed from real data so it ticks itself off.
export async function setupStatus(gymId: string) {
  const [gym, plans, members, staff, classes] = await Promise.all([
    db.gym.findUniqueOrThrow({ where: { id: gymId }, select: { phone: true, address: true, upiId: true, whatsapp: true, openTime: true, logoUrl: true, setupDoneAt: true } }),
    db.plan.count({ where: { gymId, active: true } }),
    db.member.count({ where: { gymId } }),
    db.user.count({ where: { gymId, role: { in: ["RECEPTION", "TRAINER"] }, active: true } }),
    db.gymClass.count({ where: { gymId } }),
  ]);
  const steps = [
    { key: "profile", label: "Add gym phone, address and timings", done: !!(gym.phone && gym.address && gym.openTime), href: "/settings", hint: "Printed on receipts and shown to members." },
    { key: "upi", label: "Set your UPI ID and WhatsApp number", done: !!(gym.upiId && gym.whatsapp), href: "/settings", hint: "Members get a Pay-by-UPI button and a WhatsApp link." },
    { key: "plans", label: "Review your membership plans and prices", done: plans > 0, href: "/plans", hint: "Monthly, quarterly and yearly plans are created for you; edit the prices." },
    { key: "members", label: "Add your first member (or import your Excel list)", done: members > 0, href: "/members/import", hint: "Import brings members, plans and paid amounts in one go." },
    { key: "staff", label: "Invite reception and trainers", done: staff > 0, href: "/staff", hint: "Each gets their own login with the right access." },
    { key: "classes", label: "Set up group classes (optional)", done: classes > 0, href: "/classes", hint: "Zumba, yoga, batches with fixed timings." },
    { key: "phone", label: "Put GYMBASE on the reception phone", done: false, href: "/install", hint: "Install as an app; the check-in desk and QR scan work from it." },
  ];
  const required = steps.filter((s) => s.key !== "classes" && s.key !== "phone");
  return { steps, done: required.filter((s) => s.done).length, total: required.length, complete: required.every((s) => s.done), dismissed: !!gym.setupDoneAt };
}
