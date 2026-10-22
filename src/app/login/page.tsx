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
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) redirect(err instanceof CredentialsSignin && err.code === "throttled" ? "/login?error=throttled" : "/login?error=1");
    throw err;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; gym?: string; email?: string; joined?: string }> }) {
  const { error, gym, email, joined } = await searchParams;
  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-base";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">Sign in to GYMBASE</h1>
      {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">{error === "throttled" ? "Too many failed attempts. Wait 15 minutes and try again." : "Wrong gym, email or password."}</p>}
      {joined && <p className="mb-4 rounded bg-green-50 p-2 text-sm text-green-800">Your login is ready. Sign in below.</p>}
      <form action={login} className="space-y-3">
        <input name="gym" placeholder="Gym code (e.g. demo)" defaultValue={gym ?? ""} required autoFocus className={input} />
        <input name="email" placeholder="Email (staff) or phone (members)" defaultValue={email ?? ""} required className={input} autoComplete="username" />
        <input name="password" type="password" placeholder="Password or PIN" required className={input} />
        <button className="w-full rounded bg-neutral-900 py-2 font-medium text-white">Sign in</button>
      </form>
      <p className="mt-3 text-center text-sm"><a href="/forgot" className="text-neutral-500 underline">Forgot password?</a></p>
      <p className="mt-2 text-center text-sm text-neutral-500">New gym? <a href="/signup" className="underline">Start a free trial</a></p>
      <p className="mt-2 text-center text-sm text-neutral-500"><a href="/install" className="underline">Get the app on your phone</a></p>
    </main>
  );
}
