import Link from "next/link";
import { InstallButton } from "@/components/pwa";

export const metadata = { title: "Install the app · GYMBASE" };

const APK_URL = process.env.NEXT_PUBLIC_APK_URL ?? "https://github.com/Agdevesh/gymbase/releases/latest/download/gymbase.apk";

/** Public page: Android APK download plus add-to-home-screen steps for Android Chrome and iPhone Safari. */
export default function InstallPage() {
  const step = "flex gap-3";
  const num = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white";
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900">← Sign in</Link>
      <h1 className="mt-2 mb-1 text-2xl font-semibold">Get GYMBASE on your phone</h1>
      <p className="mb-6 text-slate-600">Works on Android and iPhone. Pick whichever is easiest; both open the same account.</p>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mb-6 p-4">
        <h2 className="mb-1 text-lg font-semibold">Option 1: Add to home screen</h2>
        <p className="mb-3 text-sm text-slate-600">No download needed. The app icon appears on your phone like any other app and always runs the latest version.</p>
        <InstallButton className="mb-3 rounded-lg bg-slate-100 p-2 text-sm text-slate-700" />
        <h3 className="mt-4 mb-2 font-medium">Android (Chrome)</h3>
        <ol className="space-y-2 text-sm">
          <li className={step}><span className={num}>1</span>Open this page in Chrome.</li>
          <li className={step}><span className={num}>2</span>Tap the ⋮ menu at the top right.</li>
          <li className={step}><span className={num}>3</span>Tap <b>Add to Home screen</b> (or <b>Install app</b>), then <b>Install</b>.</li>
        </ol>
        <h3 className="mt-4 mb-2 font-medium">iPhone (Safari)</h3>
        <ol className="space-y-2 text-sm">
          <li className={step}><span className={num}>1</span>Open this page in Safari.</li>
          <li className={step}><span className={num}>2</span>Tap the Share button (square with an arrow) at the bottom.</li>
          <li className={step}><span className={num}>3</span>Scroll and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        </ol>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <h2 className="mb-1 text-lg font-semibold">Option 2: Android APK</h2>
        <p className="mb-3 text-sm text-slate-600">Download and install the app file directly. Good for sharing on WhatsApp with staff.</p>
        <a href={APK_URL} className="block w-full rounded-lg border border-slate-900 py-3 text-center text-base font-medium text-slate-900">Download Android app (APK)</a>
        <ol className="mt-4 space-y-2 text-sm">
          <li className={step}><span className={num}>1</span>Tap Download. If Chrome warns about the file type, tap <b>Download anyway</b>.</li>
          <li className={step}><span className={num}>2</span>Open the downloaded file from the notification bar.</li>
          <li className={step}><span className={num}>3</span>If asked, allow Chrome to <b>install unknown apps</b>, then tap <b>Install</b>.</li>
        </ol>
      </section>
      <p className="mt-6 text-center text-xs text-slate-500">Not on the Play Store yet. The APK is published by the GYMBASE team.</p>
    </main>
  );
}
