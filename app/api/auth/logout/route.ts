import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth";
import { requestUrl } from "@/lib/http";

export async function POST(request: Request) {
  const response = NextResponse.redirect(requestUrl(request, "/"), { status: 303 });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.cookies.set({
    ...sessionCookieOptions(),
    value: "",
    maxAge: 0,
    expires: new Date(0)
  });
  return response;
}
