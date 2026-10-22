"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { planInput } from "@/lib/memberships";
import { requireTenant } from "@/server/tenant";
import type { FormState } from "@/server/members";

function readPlan(formData: FormData) {
  const raw = Object.fromEntries(["name", "type", "durationDays", "pricePaise", "ptSessions", "active"].map((f) => [f, formData.get(f) == null ? undefined : String(formData.get(f))]));
  // The checkbox sits after a hidden "off" input, so read every value and look for "on".
  const parsed = planInput.safeParse({ ...raw, ptSessions: raw.ptSessions ?? "", active: formData.getAll("active").includes("on") ? "on" : "off" });
  if (parsed.success) return { data: parsed.data };
  const errors: Record<string, string> = {};
  for (const i of parsed.error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}

export async function createPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId } = await requireTenant("gym:manage");
  const r = readPlan(formData);
  if (!r.data) return { errors: r.errors };
  await db.plan.create({ data: { ...r.data, gymId, ptSessions: r.data.type === "PT" ? r.data.ptSessions : null } });
  revalidatePath("/plans");
  redirect("/plans");
}

export async function updatePlan(planId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId } = await requireTenant("gym:manage");
  const r = readPlan(formData);
  if (!r.data) return { errors: r.errors };
  // Existing memberships keep their own pricePaise, so editing a plan never rewrites history.
  const { count } = await db.plan.updateMany({ where: { id: planId, gymId }, data: { ...r.data, ptSessions: r.data.type === "PT" ? r.data.ptSessions : null } });
  if (count === 0) return { message: "Plan not found" };
  revalidatePath("/plans");
  redirect("/plans");
}

export async function togglePlan(planId: string, active: boolean) {
  const { gymId } = await requireTenant("gym:manage");
  await db.plan.updateMany({ where: { id: planId, gymId }, data: { active } });
  revalidatePath("/plans");
}
