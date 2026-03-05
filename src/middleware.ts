import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the login page and auth API through
  if (pathname === "/login" || pathname === "/api/auth") {
    return NextResponse.next();
  }

  // Allow static assets through
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg")
  ) {
    return NextResponse.next();
  }

  // Check auth cookie
  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // For pages, redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Validate token — decode and check the password matches
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const password = decoded.split(":")[0];
    if (password !== process.env.SITE_PASSWORD) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("auth_token");
      return response;
    }
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("auth_token");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
