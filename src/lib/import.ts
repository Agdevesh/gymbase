import { normalizePhone } from "@/lib/members";

// Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF). Excel "Save as CSV" output parses fine.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export const IMPORT_COLUMNS = ["name", "phone", "email", "gender", "dob", "joined", "plan", "start", "end", "paid", "notes"] as const;
export type ImportRow = { line: number; name: string; phone: string; email: string | null; gender: "MALE" | "FEMALE" | "OTHER" | null; dob: Date | null; joined: Date | null; plan: string | null; start: Date | null; end: Date | null; paidPaise: number; notes: string | null; errors: string[] };

const HEADER_ALIASES: Record<string, (typeof IMPORT_COLUMNS)[number]> = { name: "name", "member name": "name", "full name": "name", phone: "phone", mobile: "phone", "phone number": "phone", contact: "phone", email: "email", gender: "gender", sex: "gender", dob: "dob", "date of birth": "dob", birthday: "dob", joined: "joined", "joining date": "joined", "join date": "joined", plan: "plan", package: "plan", membership: "plan", start: "start", "start date": "start", "plan start": "start", end: "end", "end date": "end", expiry: "end", "expiry date": "end", "plan end": "end", paid: "paid", amount: "paid", "amount paid": "paid", fees: "paid", notes: "notes", remarks: "notes" };

export function mapHeader(header: string[]) {
  return header.map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? null);
}

// Accepts 2026-01-31, 31/01/2026, 31-01-2026, 31.01.26 and Excel's 1/31/2026 when the first part is > 12.
export function parseDate(v: string): Date | null {
  const s = v.trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(s);
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3];
    if (y < 100) y += 2000;
    if (a <= 12 && b > 12) [a, b] = [b, a]; // US order
    return valid(y, b, a);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function valid(y: number, mo: number, d: number) { const dt = new Date(y, mo - 1, d, 12); return dt.getMonth() === mo - 1 ? dt : null; }

export function parseRows(rows: string[][]): { rows: ImportRow[]; unknownHeader: boolean } {
  if (!rows.length) return { rows: [], unknownHeader: true };
  const cols = mapHeader(rows[0]);
  if (!cols.includes("name") || !cols.includes("phone")) return { rows: [], unknownHeader: true };
  const get = (r: string[], k: (typeof IMPORT_COLUMNS)[number]) => { const i = cols.indexOf(k); return i >= 0 ? (r[i] ?? "").trim() : ""; };
  const out: ImportRow[] = rows.slice(1).map((r, i) => {
    const errors: string[] = [];
    const name = get(r, "name"), phoneRaw = get(r, "phone");
    const phone = normalizePhone(phoneRaw);
    if (!name) errors.push("name missing");
    if (!phone) errors.push(`bad phone "${phoneRaw}"`);
    const g = get(r, "gender").toUpperCase();
    const gender = g.startsWith("M") ? "MALE" : g.startsWith("F") ? "FEMALE" : g ? "OTHER" : null;
    const dates = { dob: get(r, "dob"), joined: get(r, "joined"), start: get(r, "start"), end: get(r, "end") };
    const parsed = Object.fromEntries(Object.entries(dates).map(([k, v]) => { const d = parseDate(v); if (v && !d) errors.push(`bad ${k} date "${v}"`); return [k, d]; })) as Record<keyof typeof dates, Date | null>;
    const paidRaw = get(r, "paid").replace(/[^\d.]/g, "");
    const paidPaise = paidRaw ? Math.round(Number(paidRaw) * 100) : 0;
    if (parsed.start && parsed.end && parsed.end <= parsed.start) errors.push("end before start");
    const email = get(r, "email").toLowerCase() || null;
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("bad email");
    return { line: i + 2, name, phone: phone ?? phoneRaw, email, gender, dob: parsed.dob, joined: parsed.joined, plan: get(r, "plan") || null, start: parsed.start, end: parsed.end, paidPaise, notes: get(r, "notes") || null, errors };
  });
  return { rows: out, unknownHeader: false };
}

export const TEMPLATE_CSV = "name,phone,email,gender,dob,joined,plan,start,end,paid,notes\nRahul Sharma,9876543210,rahul@example.com,M,1995-04-12,2025-01-10,Monthly,2026-10-01,2026-10-31,1500,Morning batch\nPriya Verma,9123456780,,F,,2024-06-01,Yearly,2026-03-15,2027-03-14,12000,\n";
