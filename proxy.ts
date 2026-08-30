import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jetonValide } from "@/lib/auth";
import { CHEMIN_ACCES, COOKIE_ACCES } from "@/lib/constants";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === CHEMIN_ACCES) {
    return NextResponse.next();
  }
  if (jetonValide(request.cookies.get(COOKIE_ACCES)?.value)) {
    return NextResponse.next();
  }
  const destination = request.nextUrl.clone();
  destination.pathname = CHEMIN_ACCES;
  destination.search = "";
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|apple-icon.png|manifest.webmanifest).*)",
  ],
};
