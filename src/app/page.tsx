import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PLAN_CODES, SAAS_PLANS, limitLabel } from "@/lib/saas";

export const metadata: Metadata = {
  title: "GYMBASE · Gym management software for Indian gyms",
  description: "Check-in with QR, memberships and renewals, dues with UPI, WhatsApp reminders, leads, PT scheduling, classes, expenses and reports. Built for gyms in India. 14-day free trial.",
  openGraph: { title: "GYMBASE · Run your gym from your phone", description: "Members, dues, UPI, WhatsApp reminders, PT, classes and reports in one simple app for Indian gyms.", type: "website" },
};

const FEATURES: [string, string][] = [
  ["QR check-in desk", "Members scan a card or their phone; see who is in the gym right now and who stopped coming."],
  ["Memberships & renewals", "Monthly to yearly plans, freeze, upgrade with pro-rata, auto-expiry and a defaulters list."],
  ["Dues with UPI", "Invoices with GST, Pay-by-UPI links and QR, cash closing at the end of the day."],
  ["WhatsApp receipts & reminders", "Receipts, renewal, dues, birthday and PT reminders go out on WhatsApp (or by hand with one tap)."],
  ["Inquiries & follow-ups", "Walk-ins, Instagram and WhatsApp leads with follow-up dates and one-click conversion."],
  ["Trainers & PT", "PT plans with session counts, trainer time slots, commissions and attendance."],
  ["Classes & lockers", "Zumba, yoga and batch timetables with bookings; numbered lockers with rent."],
  ["Member app", "Members see their plan, dues, QR, diet and workout plan, progress and classes on their phone."],
  ["Expenses & reports", "Rent, salaries, electricity; monthly profit & loss, peak hours, renewal rate, best plans."],
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect(session.user.role === "MEMBER" ? "/me" : "/dashboard");
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <span className="text-lg font-bold tracking-tight">GYMBASE</span>
        <nav className="flex items-center gap-3 text-sm"><Link href="/install" className="hidden text-slate-600 hover:underline sm:inline">Get the app</Link><Link href="/login" className="text-slate-600 hover:underline">Sign in</Link><Link href="/signup" className="rounded-lg bg-brand-600 hover:bg-brand-700 px-3 py-1.5 font-medium text-white">Free trial</Link></nav>
      </header>
      <section className="py-10 text-center sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Run your gym from your phone.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">Check-ins, memberships, dues on UPI, WhatsApp reminders, leads, trainers and reports. Made for gyms in India, simple enough for reception to learn in a day.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="rounded-lg bg-brand-600 hover:bg-brand-700 px-6 py-3 font-medium text-white">Start 14-day free trial</Link>
          <Link href="/login?gym=demo&email=owner@demo.gym" className="rounded border bg-white px-6 py-3 font-medium">See the demo</Link>
        </div>
        <p className="mt-3 text-sm text-slate-500">No card needed · Works on any Android phone · Hindi/English support on WhatsApp</p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {FEATURES.map(([t, d]) => <div key={t} className="rounded-lg border bg-white p-4"><h2 className="font-semibold">{t}</h2><p className="mt-1 text-sm text-slate-600">{d}</p></div>)}
      </section>
      <section className="mt-14">
        <h2 className="text-center text-2xl font-bold">Simple pricing</h2>
        <p className="mt-1 text-center text-slate-600">Per gym, per month. Change or cancel anytime.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PLAN_CODES.map((c) => { const p = SAAS_PLANS[c]; return (
            <div key={c} className={`rounded-lg border bg-white p-5 ${c === "growth" ? "ring-2 ring-slate-900" : ""}`}>
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="text-sm text-slate-500">{p.blurb}</p>
              <p className="mt-3 text-3xl font-bold">₹{(p.pricePaise / 100).toLocaleString("en-IN")}<span className="text-base font-normal text-slate-500">/month</span></p>
              <ul className="mt-3 space-y-1 text-sm text-slate-700"><li>{limitLabel(p.memberLimit)} members</li><li>{limitLabel(p.staffLimit)} staff logins</li><li>All features included</li></ul>
              <Link href="/signup" className="mt-4 block rounded-lg bg-brand-600 hover:bg-brand-700 py-2 text-center text-sm font-medium text-white">Start free</Link>
            </div>); })}
        </div>
      </section>
      <section className="mt-14 rounded-2xl bg-brand-700 p-6 text-center text-white">
        <h2 className="text-xl font-semibold">Already have members in Excel?</h2>
        <p className="mt-1 text-slate-300">Import names, phones, plans and paid amounts in one go. Your data stays yours: export everything as CSV any time.</p>
      </section>
      <footer className="mt-10 text-center text-xs text-slate-500">GYMBASE · <Link href="/install" className="underline">Install the app</Link> · <Link href="/login" className="underline">Sign in</Link></footer>
    </main>
  );
}
