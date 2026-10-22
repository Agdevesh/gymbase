import { requestReset } from "@/server/settings";
import { ForgotForm } from "@/components/settings-forms";

export default function ForgotPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold">Forgot password</h1>
      <p className="mb-4 text-sm text-slate-500">We email a reset link when the gym has email set up. Otherwise the gym owner can reset your password from the Staff page.</p>
      <ForgotForm action={requestReset} />
      <p className="mt-4 text-center text-sm text-slate-500"><a href="/login" className="font-medium text-brand-700 hover:underline">Back to sign in</a></p>
    </main>
  );
}
