import type { CapacitorConfig } from "@capacitor/cli";

// The APK is a thin shell: the WebView loads the deployed GYMBASE site, so every release of the
// web app reaches phones without a new APK. Override the URL with GYMBASE_URL at `cap sync` time.
const url = process.env.GYMBASE_URL ?? "https://gymbase.vercel.app";

const config: CapacitorConfig = {
  appId: "app.gymbase.android",
  appName: "GYMBASE",
  webDir: "www",
  server: { url, cleartext: false },
  android: { allowMixedContent: false, backgroundColor: "#fafafa" },
};

export default config;
