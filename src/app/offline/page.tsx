export const metadata = { title: "Offline · GYMBASE" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 text-2xl font-semibold">You are offline</h1>
      <p className="mb-6 text-neutral-600">GYMBASE needs internet to load members and check-ins. Turn on mobile data or Wi-Fi and try again.</p>
      <a href="/dashboard" className="rounded bg-neutral-900 px-4 py-2 font-medium text-white">Try again</a>
    </main>
  );
}
