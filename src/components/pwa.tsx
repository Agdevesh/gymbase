"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

/** Registers the service worker once per page load. Rendered in the root layout. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

/** "Install app" button: uses Chrome's native prompt when available, otherwise tells the user what to do. */
export function InstallButton({ className }: { className?: string }) {
  const [state, setState] = useState<"unknown" | "ready" | "installed" | "manual">("unknown");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return setState("installed");
    if (deferredPrompt) return setState("ready");
    const onPrompt = () => setState("ready");
    const onInstalled = () => setState("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const t = setTimeout(() => setState((s) => (s === "unknown" ? "manual" : s)), 1500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  if (state === "installed") return <p className={className}>✓ GYMBASE is installed on this device. Open it from your home screen.</p>;
  if (state === "ready") {
    return (
      <button
        type="button"
        className="w-full rounded bg-neutral-900 py-3 text-base font-medium text-white"
        onClick={async () => {
          if (!deferredPrompt) return;
          await deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === "accepted") setState("installed");
          deferredPrompt = null;
        }}
      >
        Install GYMBASE on this phone
      </button>
    );
  }
  if (state === "manual") return <p className={className}>Your browser did not offer a one-tap install. Follow the steps for your phone below.</p>;
  return null;
}
