"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { TAB_HREFS, activeHref, type NavGroup } from "@/components/nav/items";

const COLLAPSE_KEY = "gb:nav-collapsed";

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
}

type Props = { groups: NavGroup[]; gymName: string; userLabel: string; signOut: React.ReactNode };

// Desktop: a collapsible left sidebar with grouped sections. Phone: a top bar with a drawer, plus a bottom tab bar.
export function AppNav({ groups, gymName, userLabel, signOut }: Props) {
  const pathname = usePathname();
  const all = groups.flatMap((g) => g.items);
  const active = activeHref(pathname, all.map((i) => i.href));
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { setCollapsed(readCollapsed()); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.documentElement.dataset.nav = collapsed ? "rail" : "full";
  }, [collapsed]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {}
  };

  const tabs = TAB_HREFS.map((h) => all.find((i) => i.href === h)).filter((i): i is NonNullable<typeof i> => Boolean(i));
  const tabActive = tabs.some((t) => t.href === active);

  const list = (compact: boolean) => (
    <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Main">
      {groups.map((g) => (
        <div key={g.label} className="mb-2">
          {!compact && <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>}
          {compact && <hr className="mx-3 my-2 border-slate-200 first:hidden" />}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const isActive = i.href === active;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    title={compact ? i.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${compact ? "justify-center" : ""} ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                  >
                    <Icon name={i.icon} size={20} className={isActive ? "text-brand-600" : "text-slate-400"} />
                    {!compact && <span className="truncate">{i.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-white md:flex ${collapsed ? "w-16" : "w-60"}`}>
        <div className={`flex h-14 items-center border-b border-slate-200 ${collapsed ? "justify-center" : "gap-2 px-4"}`}>
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">G</span>
            {!collapsed && <span className="truncate">{gymName}</span>}
          </Link>
        </div>
        {list(collapsed)}
        <div className="border-t border-slate-200 p-2">
          {!collapsed && <p className="truncate px-3 pb-1 text-xs text-slate-500">{userLabel}</p>}
          <div className={`flex items-center ${collapsed ? "flex-col gap-1" : "justify-between"}`}>
            <div className={collapsed ? "" : "px-1"}>{signOut}</div>
            <button type="button" onClick={toggle} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-slate-200 bg-white/95 px-3 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">G</span>
          <span className="truncate">{gymName}</span>
        </Link>
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
          <Icon name="menu" size={22} />
        </button>
      </header>

      {/* Phone drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col bg-white shadow-xl">
            <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{gymName}</p><p className="truncate text-xs text-slate-500">{userLabel}</p></div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Close menu"><Icon name="close" size={20} /></button>
            </div>
            {list(false)}
            <div className="border-t border-slate-200 p-3">{signOut}</div>
          </div>
        </div>
      )}

      {/* Phone bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Quick">
        {tabs.map((t) => {
          const isActive = t.href === active;
          return (
            <Link key={t.href} href={t.href} aria-current={isActive ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? "text-brand-600" : "text-slate-500"}`}>
              <Icon name={t.icon} size={22} />
              {t.label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} className={`flex flex-col items-center gap-0.5 py-2 !text-[11px] font-medium ${!tabActive && active ? "text-brand-600" : "text-slate-500"}`}>
          <Icon name="more" size={22} />
          More
        </button>
      </nav>
    </>
  );
}
