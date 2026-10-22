import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      gym: formData.get("gym"),
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: String(formData.get("next") ?? "").startsWith("/") ? String(formData.get("next")) : "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) redirect(err instanceof CredentialsSignin && err.code === "throttled" ? "/login?error=throttled" : "/login?error=1");
    throw err;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; gym?: string; email?: string; joined?: string; next?: string }> }) {
  const { error, gym, email, joined, next } = await searchParams;
  const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-emerald-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">G</span>
        <div><h1 className="text-xl font-semibold text-slate-900">Sign in to GYMBASE</h1><p className="text-sm text-slate-500">Gym owners, staff and members</p></div>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error === "throttled" ? "Too many failed attempts. Wait 15 minutes and try again." : "Wrong gym, email or password."}</p>}
      {joined && <p className="mb-4 rounded-lg bg-green-50 p-2 text-sm text-green-800">Your login is ready. Sign in below.</p>}
      <form action={login} className="space-y-3">
        {next && <input type="hidden" name="next" value={next} />}
        <input name="gym" placeholder="Gym code (e.g. demo)" defaultValue={gym ?? ""} required autoFocus className={input} />
        <input name="email" placeholder="Email (staff) or phone (members)" defaultValue={email ?? ""} required className={input} autoComplete="username" />
        <input name="password" type="password" placeholder="Password or PIN" required className={input} />
        <button className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 shadow-sm">Sign in</button>
      </form>
      <p className="mt-3 text-center text-sm"><a href="/forgot" className="text-slate-500 hover:underline">Forgot password?</a></p>
      <p className="mt-2 text-center text-sm text-slate-500">New gym? <a href="/signup" className="font-medium text-brand-700 hover:underline">Start a free trial</a></p>
      <p className="mt-2 text-center text-sm text-slate-500"><a href="/install" className="font-medium text-brand-700 hover:underline">Get the app on your phone</a></p>
      </div>
    </main>
  );
}
