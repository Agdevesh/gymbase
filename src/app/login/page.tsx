import { AuthError } from "next-auth";
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
    if (err instanceof AuthError) redirect("/login?error=1");
    throw err;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; gym?: string; email?: string; joined?: string }> }) {
  const { error, gym, email, joined } = await searchParams;
  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-base";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">Sign in to GYMBASE</h1>
      {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">Wrong gym, email or password.</p>}
      {joined && <p className="mb-4 rounded bg-green-50 p-2 text-sm text-green-800">Your login is ready. Sign in below.</p>}
      <form action={login} className="space-y-3">
        <input name="gym" placeholder="Gym code (e.g. demo)" defaultValue={gym ?? ""} required autoFocus className={input} />
        <input name="email" type="email" placeholder="Email" defaultValue={email ?? ""} required className={input} />
        <input name="password" type="password" placeholder="Password" required className={input} />
        <button className="w-full rounded bg-neutral-900 py-2 font-medium text-white">Sign in</button>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-500">New gym? <a href="/signup" className="underline">Start a free trial</a></p>
    </main>
  );
}
