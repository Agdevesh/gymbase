import Link from "next/link";
import { cache } from "react";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { Icon } from "@/components/icons";
import { AppNav } from "@/components/nav/app-nav";
import { navForRole } from "@/components/nav/items";

// One gym-name lookup per request even when a page renders the shell more than once.
const gymName = cache(async (gymId: string) => (await db.gym.findUnique({ where: { id: gymId }, select: { name: true } }))?.name ?? "GYMBASE");

export type AppShellProps = { title: string; actions?: React.ReactNode; back?: { href: string; label: string }; children: React.ReactNode; wide?: boolean; subtitle?: React.ReactNode };

// Every staff screen renders inside this: sidebar on desktop, top bar + bottom tabs on phones, then the page header.
export async function AppShell({ title, actions, children, back, wide, subtitle }: AppShellProps) {
  const session = await auth();
  const role = session?.user.role ?? "RECEPTION";
  const name = session?.user.gymId ? await gymName(session.user.gymId) : "GYMBASE";
  const userLabel = `${session?.user.name ?? ""} · ${role.toLowerCase()}`;
  const signOutForm = (
    <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
      <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Sign out"><Icon name="logout" size={18} /><span className="sidebar-label">Sign out</span></button>
    </form>
  );
  return (
    <div className="app-root min-h-screen">
      <AppNav groups={navForRole(role)} gymName={name} userLabel={userLabel} signOut={signOutForm} />
      <main className={`app-main w-full px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-6 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
        {back && <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><Icon name="chevronLeft" size={16} />{back.label}</Link>}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        {children}
      </main>
    </div>
  );
}
