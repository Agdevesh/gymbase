import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Gate every app route; /login, invite links, the auth API, cron endpoints (own secret) and static files stay public.
export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|api/cron|invite/|_next/static|_next/image|favicon.ico).*)"],
};
