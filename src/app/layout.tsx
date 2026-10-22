import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/pwa";
import "./globals.css";

export const metadata: Metadata = {
  title: "GYMBASE",
  applicationName: "GYMBASE",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "GYMBASE", statusBarStyle: "default" },
  formatDetection: { telephone: true },
};

export const viewport: Viewport = {
  themeColor: "#171717",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
