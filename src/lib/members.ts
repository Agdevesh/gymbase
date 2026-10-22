import { z } from "zod";

// Accepts what reception types ("98765 43210", "098765-43210", "+91 98765 43210") and stores E.164.
export function normalizePhone(raw: string, defaultCountryCode = "91"): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  let e164: string;
  if (trimmed.startsWith("+")) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+${defaultCountryCode}${digits}`;
  else if (digits.length === 11 && digits.startsWith("0")) e164 = `+${defaultCountryCode}${digits.slice(1)}`;
  else e164 = `+${digits}`;
  return /^\+[1-9]\d{9,14}$/.test(e164) ? e164 : null;
}

export const formatMemberCode = (seq: number) => `GB-${String(seq).padStart(4, "0")}`;

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((v) => v || null);

const phone = z.string().transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
  return p ?? "";
});

const optionalPhone = z.string().transform((v, ctx) => {
  if (!v.trim()) return null;
  const p = normalizePhone(v);
  if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
  return p;
});

export const memberInput = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: optionalText(60),
  phone,
  email: z.union([z.literal("").transform(() => null), z.string().trim().toLowerCase().email("Enter a valid email")]),
  gender: z.union([z.literal("").transform(() => null), z.enum(["MALE", "FEMALE", "OTHER"])]),
  dob: z.union([
    z.literal("").transform(() => null),
    z.iso.date("Enter a valid date").transform((d) => new Date(`${d}T00:00:00Z`)),
  ]),
  address: optionalText(300),
  emergencyName: optionalText(80),
  emergencyPhone: optionalPhone,
  usualTime: optionalText(40),
  notes: optionalText(2000),
});
export type MemberInput = z.infer<typeof memberInput>;

export const memberFields = Object.keys(memberInput.shape) as (keyof MemberInput)[];

export const noteInput = z.object({ body: z.string().trim().min(1, "Note is empty").max(2000) });
export const documentLabel = z.string().trim().min(1, "Give the document a name").max(80);

export const UPLOAD_RULES = {
  photo: { maxBytes: 2 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp"] },
  document: { maxBytes: 4 * 1024 * 1024, mimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"] },
} as const;

export function checkUpload(file: unknown, kind: keyof typeof UPLOAD_RULES): string | null {
  const rule = UPLOAD_RULES[kind];
  if (!(file instanceof File) || file.size === 0) return "Choose a file";
  if (!(rule.mimes as readonly string[]).includes(file.type)) return `Unsupported file type (${file.type || "unknown"})`;
  if (file.size > rule.maxBytes) return `File is larger than ${rule.maxBytes / 1024 / 1024} MB`;
  return null;
}

export const fileUrl = (id: string) => `/api/files/${id}`;
export const fileIdFromUrl = (url: string | null) => url?.match(/^\/api\/files\/([\w-]+)$/)?.[1] ?? null;
