import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Gate every app route; /login, the auth API and static files stay public.
export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
