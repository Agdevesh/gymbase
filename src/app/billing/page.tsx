import { db } from "@/lib/db";
import { paise } from "@/lib/payments";
import { razorpayConfigured } from "@/lib/razorpay";
import { PLAN_CODES, SAAS_PLANS, limitLabel, subscriptionState } from "@/lib/saas";
import { requireTenant } from "@/server/tenant";
import { cancelPlan } from "@/server/saas";
import { AppShell } from "@/components/ui";
import { ChoosePlanButton } from "@/components/saas-forms";

export const dynamic = "force-dynamic";
const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ locked?: string }> }) {
  const { gymId } = await requireTenant("gym:manage", { skipSubscriptionCheck: true });
  const { locked } = await searchParams;
  const [sub, members, staff] = await Promise.all([
    db.subscription.findUnique({ where: { gymId } }),
    db.member.count({ where: { gymId } }),
    db.user.count({ where: { gymId, role: { in: ["RECEPTION", "TRAINER"] }, active: true } }),
  ]);
  const state = subscriptionState(sub, new Date());
  const online = razorpayConfigured();
  const usage = (n: number, limit: number) => <span className={n >= limit ? "text-red-700" : ""}>{n} / {limitLabel(limit)}</span>;
  return (
    <AppShell title="GYMBASE plan">
      {(locked || state.locked) && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800">{state.reason ?? "Your gym is in read-only mode until a plan is active."}</p>}
      {sub && (
        <section className="mb-4 rounded border bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-medium">{SAAS_PLANS[sub.planCode as keyof typeof SAAS_PLANS]?.name ?? sub.planCode} <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-normal">{state.label}</span></h2>
            <span className="text-sm text-neutral-600">
              {sub.status === "TRIAL" && (state.daysLeft ? `Trial ends ${fmt(sub.trialEndsAt)} (${state.daysLeft} days left)` : `Trial ended ${fmt(sub.trialEndsAt)}`)}
              {sub.status === "ACTIVE" && (sub.cancelAtPeriodEnd ? `Ends ${fmt(sub.renewsAt)}` : `Renews ${fmt(sub.renewsAt)}`)}
              {sub.status === "PAST_DUE" && `Payment due since ${fmt(sub.renewsAt)}`}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-neutral-500">Members</dt><dd className="text-lg font-medium">{usage(members, sub.memberLimit)}</dd></div>
            <div><dt className="text-neutral-500">Staff logins</dt><dd className="text-lg font-medium">{usage(staff, sub.staffLimit)}</dd></div>
          </dl>
          {sub.status === "ACTIVE" && !sub.cancelAtPeriodEnd && <form action={cancelPlan} className="mt-3"><button className="text-xs text-red-700 underline">Cancel at the end of this period</button></form>}
        </section>
      )}
      {!online && <p className="mb-3 text-sm text-neutral-600">Online payment is not connected on this deployment. Pick a plan and we&apos;ll activate it for you by email.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {PLAN_CODES.map((code) => {
          const p = SAAS_PLANS[code];
          const current = sub?.planCode === code && sub.status === "ACTIVE";
          return (
            <section key={code} className={`rounded border bg-white p-4 ${current ? "border-neutral-900" : ""}`}>
              <h3 className="font-medium">{p.name}</h3>
              <p className="text-2xl font-semibold">{paise(p.pricePaise)}<span className="text-sm font-normal text-neutral-500">/month</span></p>
              <p className="text-sm text-neutral-600">{p.blurb}</p>
              <ul className="mt-2 text-sm text-neutral-700"><li>{limitLabel(p.memberLimit)} members</li><li>{limitLabel(p.staffLimit)} staff logins</li><li>All modules included</li></ul>
              <ChoosePlanButton code={code} label={sub?.status === "ACTIVE" ? "Switch to this plan" : "Choose plan"} current={current} />
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-neutral-500">Prices exclude GST. Payments are processed by Razorpay; you can cancel any time and keep access until the period ends.</p>
    </AppShell>
  );
}
