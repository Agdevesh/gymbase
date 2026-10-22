"use server";

import { randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checkUpload, fileIdFromUrl, fileUrl } from "@/lib/members";
import { sendMessage } from "@/lib/messaging";
import { rateLimit } from "@/lib/ratelimit";
import { changePasswordInput, passwordInput, settingsFields, settingsInput } from "@/lib/settings";
import { audit } from "@/server/audit";
import { requireTenant } from "@/server/tenant";
import type { FormState } from "@/server/members";
import { baseUrl } from "@/lib/base-url";

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function updateSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("gym:manage");
  const parsed = settingsInput.safeParse(Object.fromEntries(settingsFields.map((f) => [f, str(formData, f)])));
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const logo = formData.get("logo");
  const logoError = logo instanceof File && logo.size > 0 ? checkUpload(logo, "photo") : null;
  if (logoError) return { errors: { logo: logoError } };
  const removeLogo = formData.get("removeLogo") === "on";
  await db.$transaction(async (tx) => {
    const current = await tx.gym.findUniqueOrThrow({ where: { id: gymId }, select: { logoUrl: true } });
    let logoUrl = current.logoUrl;
    if (removeLogo || (logo instanceof File && logo.size > 0)) {
      const oldId = fileIdFromUrl(current.logoUrl);
      if (oldId) await tx.storedFile.deleteMany({ where: { id: oldId, gymId } });
      logoUrl = null;
    }
    if (!removeLogo && logo instanceof File && logo.size > 0) {
      const stored = await tx.storedFile.create({ data: { gymId, name: logo.name, mime: logo.type, size: logo.size, data: Buffer.from(await logo.arrayBuffer()) }, select: { id: true } });
      logoUrl = fileUrl(stored.id);
    }
    await tx.gym.update({ where: { id: gymId }, data: { ...parsed.data, logoUrl } });
  });
  await audit(gymId, userId, "settings.update", "gym", gymId, `Updated gym settings (GST ${parsed.data.gstPercent}%)`);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { message: "Saved." };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId, gymId } = await requireTenant(undefined, { skipSubscriptionCheck: true });
  const parsed = changePasswordInput.safeParse({ current: str(formData, "current"), password: str(formData, "password"), confirm: str(formData, "confirm") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await compare(parsed.data.current, user.passwordHash))) return { errors: { current: "Current password is wrong" } };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hash(parsed.data.password, 10) } });
  await audit(gymId, userId, "account.password", "user", userId, "Changed own password");
  return { message: "Password changed." };
}

export type ResetState = (FormState & { link?: string }) | undefined;

async function createResetToken(userId: string) {
  const token = randomBytes(24).toString("hex");
  await db.passwordReset.create({ data: { userId, token, expiresAt: new Date(Date.now() + 2 * 3600_000) } });
  return `${baseUrl()}/reset/${token}`;
}

// Owner resets any staff/member login from /staff; the link is shown so it can be WhatsApped.
export async function adminResetPassword(targetUserId: string): Promise<ResetState> {
  const { gymId, userId } = await requireTenant("staff:manage");
  const target = await db.user.findFirst({ where: { id: targetUserId, gymId }, select: { id: true, name: true, email: true } });
  if (!target) return { message: "User not found" };
  const link = await createResetToken(target.id);
  await audit(gymId, userId, "account.reset_link", "user", target.id, `Issued password reset link for ${target.name}`);
  await sendMessage("EMAIL", target.email, `Reset your GYMBASE password here (valid 2 hours): ${link}`, "Reset your GYMBASE password");
  return { link };
}

// Public: forgot password. Always answers the same so emails cannot be enumerated.
export async function requestReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const gym = str(formData, "gym").trim().toLowerCase(), email = str(formData, "email").trim().toLowerCase();
  if (!gym || !email) return { errors: { email: "Enter your gym code and email" } };
  if (!(await rateLimit(`reset:${gym}:${email}`, 3, 3600_000))) return { message: "Too many attempts. Try again in an hour." };
  const user = await db.user.findFirst({ where: { email, active: true, gym: { slug: gym } }, select: { id: true, gymId: true, name: true } });
  if (user) {
    const link = await createResetToken(user.id);
    const sent = await sendMessage("EMAIL", email, `Reset your GYMBASE password here (valid 2 hours): ${link}`, "Reset your GYMBASE password");
    await audit(user.gymId, null, "account.reset_request", "user", user.id, `${user.name} requested a password reset (${sent.ok ? "emailed" : "email not configured"})`);
  }
  return { message: "If that login exists, a reset link has been emailed. If your gym has no email set up, ask the owner to reset it from the Staff page." };
}

export async function completeReset(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordInput.safeParse({ password: str(formData, "password"), confirm: str(formData, "confirm") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const reset = await db.passwordReset.findUnique({ where: { token }, include: { user: { select: { id: true, gymId: true, name: true } } } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return { message: "This reset link is invalid or has expired." };
  await db.$transaction([
    db.user.update({ where: { id: reset.userId }, data: { passwordHash: await hash(parsed.data.password, 10) } }),
    db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
  ]);
  await audit(reset.user.gymId, reset.userId, "account.reset_done", "user", reset.userId, `${reset.user.name} set a new password via reset link`);
  return { message: "done" };
}
