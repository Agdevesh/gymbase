"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { checkInByToken, checkInMember, searchForCheckIn, type Candidate, type CheckInResult } from "@/server/checkin";
import { tokenFromScan } from "@/lib/checkin";
import { Avatar, StatusBadge, inputClass } from "@/components/ui";
import Link from "next/link";

const fmt = (d: Date) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

// Reception types a name, phone, code, or scans a QR (hardware scanners type the payload + Enter).
export function CheckinDesk() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState<CheckInResult | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    const term = q.trim();
    if (!term || tokenFromScan(term)) { setResults([]); return; }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const r = await searchForCheckIn(term);
      if (n === seq.current) { setResults(r); setSel(0); }
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const doCheckIn = (memberId: string, token?: string) => start(async () => {
    const r = token ? await checkInByToken(token) : await checkInMember(memberId);
    setMsg(r);
    setQ(""); setResults([]);
    input.current?.focus();
    router.refresh();
  });

  const onKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Escape") { setQ(""); setResults([]); setMsg(null); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const token = tokenFromScan(q);
      if (token) doCheckIn("", token);
      else if (results[sel]) doCheckIn(results[sel].id);
    }
  };

  return (
    <div>
      <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setMsg(null); }} onKeyDown={onKey} autoFocus autoComplete="off"
        placeholder="Name, phone, member code — or scan QR" className={`${inputClass} text-lg`} aria-label="Find member" />
      <p className="mt-1 text-xs text-neutral-500">↑↓ to choose, Enter to check in, Esc to clear</p>
      {msg && (
        <div role="status" className={`mt-3 rounded p-3 text-lg font-medium ${msg.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>
          {msg.ok ? (msg.already ? `${msg.name} is already in the gym` : `✓ ${msg.name} checked in`) : `✕ ${msg.name ? `${msg.name}: ` : ""}${msg.message}`}
        </div>
      )}
      {results.length > 0 && (
        <ul className="mt-3 divide-y rounded border bg-white" role="listbox">
          {results.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => doCheckIn(m.id)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === sel ? "bg-neutral-100" : ""}`}>
              <Avatar name={m.name} photoUrl={m.photoUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.name} <span className="font-normal text-neutral-400">{m.code}</span>{m.inGym && <span className="ml-2 rounded bg-green-100 px-1.5 text-xs text-green-800">in gym</span>}</div>
                <div className="truncate text-sm text-neutral-500">{m.phone}{m.plan && ` · ${m.plan} till ${fmt(m.endDate!)}`}</div>
                {!m.allowed && <div className="text-sm text-red-700">{m.blockedReason} <Link href={`/members/${m.id}`} className="underline" onClick={(e) => e.stopPropagation()}>Open profile</Link></div>}
              </div>
              <StatusBadge status={(m.status as "ACTIVE" | "FROZEN" | "EXPIRED" | "CANCELLED" | null) ?? "NONE"} />
            </li>
          ))}
        </ul>
      )}
      {pending && <p className="mt-2 text-sm text-neutral-500">Checking in…</p>}
    </div>
  );
}
