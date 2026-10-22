"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  checkUpload,
  documentLabel,
  fileIdFromUrl,
  fileUrl,
  formatMemberCode,
  memberFields,
  memberInput,
  noteInput,
} from "@/lib/members";
import { memberLimitError, requireTenant } from "@/server/tenant";
import { audit } from "@/server/audit";

export type FormState = { errors?: Record<string, string>; message?: string } | undefined;

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}

function readMemberForm(formData: FormData) {
  const raw = Object.fromEntries(memberFields.map((f) => [f, String(formData.get(f) ?? "")]));
  return memberInput.safeParse(raw);
}

async function storeFile(tx: Prisma.TransactionClient, gymId: string, file: File) {
  const stored = await tx.storedFile.create({
    data: { gymId, name: file.name, mime: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()) },
    select: { id: true },
  });
  return stored.id;
}

const isDuplicatePhone = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function createMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("members:write");
  const parsed = readMemberForm(formData);
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const limit = await memberLimitError(gymId);
  if (limit) return { message: limit };
  const photo = formData.get("photo");
  const photoError = photo instanceof File && photo.size > 0 ? checkUpload(photo, "photo") : null;
  if (photoError) return { errors: { photo: photoError } };

  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      // Atomic counter per gym so codes never collide under concurrent reception desks.
      const gym = await tx.gym.update({ where: { id: gymId }, data: { memberSeq: { increment: 1 } }, select: { memberSeq: true } });
      const photoUrl = photoError === null && photo instanceof File && photo.size > 0 ? fileUrl(await storeFile(tx, gymId, photo)) : null;
      const m = await tx.member.create({
        data: { ...parsed.data, gymId, code: formatMemberCode(gym.memberSeq), photoUrl },
        select: { id: true },
      });
      return m.id;
    });
  } catch (e) {
    if (isDuplicatePhone(e)) return { errors: { phone: "A member with this phone already exists" } };
    throw e;
  }
  await audit(gymId, userId, "member.create", "member", id, `Added member ${parsed.data.firstName} ${parsed.data.lastName ?? ""} (${parsed.data.phone})`);
  revalidatePath("/members");
  redirect(`/members/${id}`);
}

export async function updateMember(memberId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("members:write");
  const parsed = readMemberForm(formData);
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto) {
    const err = checkUpload(photo, "photo");
    if (err) return { errors: { photo: err } };
  }
  const removePhoto = formData.get("removePhoto") === "on";

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.member.findFirst({ where: { id: memberId, gymId }, select: { photoUrl: true } });
      if (!existing) throw new Error("Member not found");
      let photoUrl = existing.photoUrl;
      if (hasPhoto) photoUrl = fileUrl(await storeFile(tx, gymId, photo));
      else if (removePhoto) photoUrl = null;
      await tx.member.update({ where: { id: memberId }, data: { ...parsed.data, photoUrl } });
      const oldFile = fileIdFromUrl(existing.photoUrl);
      if (oldFile && photoUrl !== existing.photoUrl) await tx.storedFile.deleteMany({ where: { id: oldFile, gymId } });
    });
  } catch (e) {
    if (isDuplicatePhone(e)) return { errors: { phone: "A member with this phone already exists" } };
    throw e;
  }
  await audit(gymId, userId, "member.update", "member", memberId, `Edited member ${parsed.data.firstName} ${parsed.data.lastName ?? ""}`);
  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  redirect(`/members/${memberId}`);
}

export async function addNote(memberId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("members:write");
  const parsed = noteInput.safeParse({ body: formData.get("body") });
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const member = await db.member.findFirst({ where: { id: memberId, gymId }, select: { id: true } });
  if (!member) return { message: "Member not found" };
  await db.memberNote.create({ data: { memberId, authorId: userId, body: parsed.data.body } });
  revalidatePath(`/members/${memberId}`);
  return {};
}

export async function deleteNote(memberId: string, noteId: string) {
  const { gymId } = await requireTenant("members:write");
  await db.memberNote.deleteMany({ where: { id: noteId, member: { id: memberId, gymId } } });
  revalidatePath(`/members/${memberId}`);
}

export async function addDocument(memberId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId } = await requireTenant("members:write");
  const label = documentLabel.safeParse(formData.get("label"));
  if (!label.success) return fieldErrors(label.error.issues);
  const file = formData.get("file");
  const fileError = checkUpload(file, "document");
  if (fileError || !(file instanceof File)) return { errors: { file: fileError ?? "Choose a file" } };
  const member = await db.member.findFirst({ where: { id: memberId, gymId }, select: { id: true } });
  if (!member) return { message: "Member not found" };
  await db.$transaction(async (tx) => {
    const fileId = await storeFile(tx, gymId, file);
    await tx.memberDocument.create({ data: { memberId, label: label.data, fileId, url: fileUrl(fileId) } });
  });
  revalidatePath(`/members/${memberId}`);
  return {};
}

export async function deleteDocument(memberId: string, documentId: string) {
  const { gymId } = await requireTenant("members:write");
  const doc = await db.memberDocument.findFirst({ where: { id: documentId, member: { id: memberId, gymId } }, select: { fileId: true } });
  if (!doc) return;
  // Deleting the StoredFile cascades to the document row; a legacy external-url doc has no file.
  if (doc.fileId) await db.storedFile.delete({ where: { id: doc.fileId } });
  else await db.memberDocument.delete({ where: { id: documentId } });
  revalidatePath(`/members/${memberId}`);
}
