"use server";

import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/server/tenant";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["RECEPTION", "TRAINER"]),
});

export async function inviteStaff(input: z.infer<typeof inviteSchema>) {
  const { gymId, userId } = await requireTenant("staff:manage");
  const { email, role } = inviteSchema.parse(input);
  const sub = await db.subscription.findUnique({ where: { gymId } });
  const staffCount = await db.user.count({ where: { gymId, role: { in: ["RECEPTION", "TRAINER"] } } });
  if (sub && staffCount >= sub.staffLimit) throw new Error("Staff limit reached for your GYMBASE plan");
  return db.invite.create({
    data: {
      gymId,
      email: email.toLowerCase(),
      role,
      token: randomBytes(24).toString("hex"),
      invitedBy: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
}

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(8),
});

// Public: the invitee has no session yet, so the token is the only credential.
export async function acceptInvite(input: z.infer<typeof acceptSchema>) {
  const { token, name, password } = acceptSchema.parse(input);
  const invite = await db.invite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) throw new Error("Invite is invalid or expired");
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { gymId: invite.gymId, email: invite.email, name, role: invite.role, passwordHash: await hash(password, 10) },
    });
    await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    return u;
  });
  return { gymId: user.gymId, email: user.email };
}
