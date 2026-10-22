import Link from "next/link";
import type { ComponentProps } from "react";

export const inputClass =
  "w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
export const buttonClass = "inline-flex items-center rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50";
export const secondaryButtonClass = "inline-flex items-center rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100";

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Avatar({ name, photoUrl, size = 40 }: { name: string; photoUrl: string | null; size?: number }) {
  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-neutral-200 font-medium text-neutral-600" style={{ width: size, height: size, fontSize: size / 2.5 }}>
      {initials}
    </span>
  );
}

export function StatusBadge({ status }: { status: "ACTIVE" | "FROZEN" | "EXPIRED" | "CANCELLED" | "NONE" }) {
  const styles = {
    ACTIVE: "bg-green-100 text-green-800",
    FROZEN: "bg-blue-100 text-blue-800",
    EXPIRED: "bg-red-100 text-red-800",
    CANCELLED: "bg-neutral-200 text-neutral-700",
    NONE: "bg-neutral-100 text-neutral-500",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}>{status === "NONE" ? "No plan" : status.toLowerCase()}</span>;
}

export function AppShell({ title, actions, children, back }: { title: string; actions?: React.ReactNode; back?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl p-4">
      <nav className="-mx-4 mb-4 flex gap-x-1 overflow-x-auto whitespace-nowrap border-b bg-neutral-50 px-3 text-sm text-neutral-600 [scrollbar-width:none]">
        <Link href="/dashboard" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Dashboard</Link>
        <Link href="/checkin" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Check-in</Link>
        <Link href="/members" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Members</Link>
        <Link href="/attendance" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Attendance</Link>
        <Link href="/leads" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Inquiries</Link>
        <Link href="/payments" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Payments</Link>
        <Link href="/defaulters" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Defaulters</Link>
        <Link href="/expenses" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Expenses</Link>
        <Link href="/reports" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Reports</Link>
        <Link href="/reminders" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Reminders</Link>
        <Link href="/staff" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Staff</Link>
        <Link href="/plans" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Plans</Link>
        <Link href="/classes" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Classes</Link>
        <Link href="/lockers" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Lockers</Link>
        <Link href="/settings" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Settings</Link>
        <Link href="/account" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Account</Link>
        <Link href="/install" className="shrink-0 px-1.5 py-2 hover:text-neutral-900">Get app</Link>
      </nav>
      {back && <Link href={back.href} className="text-sm text-neutral-500 hover:text-neutral-900">← {back.label}</Link>}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        {actions && <div className="flex gap-2">{actions}</div>}
      </header>
      {children}
    </main>
  );
}

export function ButtonLink(props: ComponentProps<typeof Link> & { secondary?: boolean }) {
  const { secondary, className, ...rest } = props;
  return <Link {...rest} className={`${secondary ? secondaryButtonClass : buttonClass} ${className ?? ""}`} />;
}
