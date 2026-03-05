import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    return NextResponse.json({ error: "Password not configured" }, { status: 500 });
  }

  if (password !== sitePassword) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  // Create a simple token: base64 of password + timestamp (not cryptographically strong, but enough for basic gating)
  const token = Buffer.from(`${sitePassword}:${Date.now()}`).toString("base64");

  const response = NextResponse.json({ ok: true });
  response.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
