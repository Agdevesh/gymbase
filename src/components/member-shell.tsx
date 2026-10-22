import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Icon, type IconName } from "@/components/icons";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/me", label: "Home", icon: "home" },
  { href: "/me/classes", label: "Classes", icon: "classes" },
  { href: "/me/plan", label: "My plan", icon: "plans" },
  { href: "/me/invoices", label: "Payments", icon: "payments" },
  { href: "/me/account", label: "Account", icon: "account" },
];

export function MemberShell({ gymName, title, children }: { gymName: string; title?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">{gymName.charAt(0).toUpperCase()}</span>
          <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{gymName}</p>{title && <h1 className="text-xl font-semibold text-slate-900">{title}</h1>}</div>
        </div>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button className="flex items-center gap-1 rounded-lg px-2 py-1 !text-sm text-slate-500 hover:bg-slate-100" title="Sign out"><Icon name="logout" size={16} />Sign out</button></form>
      </header>
      {children}
      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => <Link key={t.href} href={t.href} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500 hover:text-brand-600"><Icon name={t.icon} size={22} />{t.label}</Link>)}
      </nav>
    </main>
  );
}
