import Link from "next/link";
import type { ComponentProps } from "react";
import { Icon, type IconName } from "@/components/icons";

// Design tokens for the staff app. Keep these the only place that knows the brand colours, radii and shadows.
export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-xs outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
export const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50";
export const dangerButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-xs transition-colors hover:bg-red-50 disabled:opacity-50";
export const smallButtonClass = "inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const cardClass = "rounded-xl border border-slate-200 bg-white shadow-sm";

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
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
    <span className="flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700" style={{ width: size, height: size, fontSize: size / 2.5 }}>
      {initials}
    </span>
  );
}

export type MembershipStatusLabel = "ACTIVE" | "FROZEN" | "SUSPENDED" | "EXPIRED" | "CANCELLED" | "NONE";
export function StatusBadge({ status }: { status: MembershipStatusLabel }) {
  const styles: Record<MembershipStatusLabel, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    FROZEN: "bg-sky-50 text-sky-700 ring-sky-600/20",
    SUSPENDED: "bg-red-50 text-red-700 ring-red-600/20",
    EXPIRED: "bg-amber-50 text-amber-800 ring-amber-600/20",
    CANCELLED: "bg-slate-100 text-slate-600 ring-slate-500/20",
    NONE: "bg-slate-50 text-slate-500 ring-slate-500/10",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}>{status === "NONE" ? "No plan" : status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

export type Tone = "brand" | "green" | "amber" | "red" | "violet" | "sky" | "slate";
export const TONES: Record<Tone, { icon: string; text: string; bar: string }> = {
  brand: { icon: "bg-brand-50 text-brand-600", text: "text-brand-700", bar: "bg-brand-500" },
  green: { icon: "bg-emerald-50 text-emerald-600", text: "text-emerald-700", bar: "bg-emerald-500" },
  amber: { icon: "bg-amber-50 text-amber-600", text: "text-amber-700", bar: "bg-amber-500" },
  red: { icon: "bg-red-50 text-red-600", text: "text-red-700", bar: "bg-red-500" },
  violet: { icon: "bg-violet-50 text-violet-600", text: "text-violet-700", bar: "bg-violet-500" },
  sky: { icon: "bg-sky-50 text-sky-600", text: "text-sky-700", bar: "bg-sky-500" },
  slate: { icon: "bg-slate-100 text-slate-600", text: "text-slate-700", bar: "bg-slate-400" },
};

// KPI tile: icon badge in the tone colour, big number, small context line. The number itself stays in ink unless `alert`.
export function StatTile({ label, value, sub, href, icon, tone = "brand", alert }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string; icon: IconName; tone?: Tone; alert?: boolean }) {
  const t = TONES[tone];
  const body = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${t.icon}`}><Icon name={icon} size={20} /></span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium leading-tight text-slate-500">{label}</dt>
        <dd className={`mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl ${alert ? t.text : "text-slate-900"}`}>{value}</dd>
        {sub && <dd className="mt-0.5 line-clamp-2 text-xs text-slate-500">{sub}</dd>}
      </div>
    </div>
  );
  return href ? <Link href={href} className={`${cardClass} block p-3 transition-shadow sm:p-4 hover:shadow-md`}>{body}</Link> : <div className={`${cardClass} p-3 sm:p-4`}>{body}</div>;
}

export function Card({ title, href, hrefLabel = "View all", action, children, className, tone }: { title?: React.ReactNode; href?: string; hrefLabel?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; tone?: Tone }) {
  return (
    <section className={`${cardClass} ${className ?? ""}`}>
      {(title || href || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className={`flex items-center gap-2 text-sm font-semibold ${tone ? TONES[tone].text : "text-slate-900"}`}>{title}</h2>
          <div className="flex items-center gap-2">
            {action}
            {href && <Link href={href} className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:text-brand-700">{hrefLabel}<Icon name="chevronRight" size={14} /></Link>}
          </div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ icon = "inbox", title, hint, action }: { icon?: IconName; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-5 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name={icon} size={24} /></span>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="max-w-xs text-xs text-slate-500">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "amber", children }: { tone?: "amber" | "red" | "green" | "brand"; children: React.ReactNode }) {
  const t = { amber: "border-amber-200 bg-amber-50 text-amber-900", red: "border-red-200 bg-red-50 text-red-800", green: "border-emerald-200 bg-emerald-50 text-emerald-800", brand: "border-brand-200 bg-brand-50 text-brand-800" }[tone];
  return <p className={`mb-4 rounded-lg border px-3 py-2.5 text-sm ${t}`}>{children}</p>;
}

export function ButtonLink(props: ComponentProps<typeof Link> & { secondary?: boolean }) {
  const { secondary, className, ...rest } = props;
  return <Link {...rest} className={`${secondary ? secondaryButtonClass : buttonClass} ${className ?? ""}`} />;
}
