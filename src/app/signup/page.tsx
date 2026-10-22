import { SignupForm } from "@/components/saas-forms";

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Run your gym on GYMBASE</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">Check-ins, memberships, dues, leads and reminders in one place. 14 days free, then from ₹999/month.</p>
      <SignupForm />
    </main>
  );
}
