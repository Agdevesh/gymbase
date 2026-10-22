import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Gate every app route; /login, /signup, /install, /r/ receipts, /offline, PWA files, invite links, the billing webhook, the auth API, cron endpoints (own secret) and static files stay public.
export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!$|api/auth|api/cron|api/billing/webhook|invite/|signup|forgot|reset/|r/|install|offline|manifest.webmanifest|sw.js|icons/|_next/static|_next/image|favicon.ico).*)"],
};
