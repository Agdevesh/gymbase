import Link from "next/link";
import { signOut } from "@/lib/auth";

export function MemberShell({ gymName, title, children }: { gymName: string; title?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md p-4 pb-20">
      <header className="mb-4 flex items-center justify-between">
        <div><p className="text-xs uppercase tracking-wide text-neutral-500">{gymName}</p>{title && <h1 className="text-xl font-semibold">{title}</h1>}</div>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button className="text-sm text-neutral-500 underline">Sign out</button></form>
      </header>
      {children}
      <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t bg-white py-2 text-xs">
        <Link href="/me" className="px-3 py-1">Home</Link>
        <Link href="/me/classes" className="px-3 py-1">Classes</Link>
        <Link href="/me/plan" className="px-3 py-1">My plan</Link>
        <Link href="/me/invoices" className="px-3 py-1">Payments</Link>
        <Link href="/me/account" className="px-3 py-1">Account</Link>
      </nav>
    </main>
  );
}
