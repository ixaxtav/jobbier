import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "jobbier_session";
const MAX_AGE = 60 * 86_400;
const PUBLIC_PATHS = ["/sign-in", "/sign-up"];

/**
 * Optimistic check only: bounce visitors without a session cookie to sign-in.
 * The real check (is the session valid?) happens in the data layer.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(COOKIE)?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!token && !isPublic) {
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  if (token) {
    // Keep the cookie alive as long as the session slides in the database.
    response.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
  }
  return response;
}

export const config = {
  // Skip static assets, the icon routes, and API routes (they authenticate themselves).
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt).*)"],
};
