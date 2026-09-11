import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionDuJeton } from "@/lib/auth";
import { CHEMIN_ACCES, CHEMIN_INSCRIPTION, COOKIE_ACCES } from "@/lib/constants";

const CHEMINS_PUBLICS = [CHEMIN_ACCES, CHEMIN_INSCRIPTION];

export function proxy(request: NextRequest) {
  if (CHEMINS_PUBLICS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  if (sessionDuJeton(request.cookies.get(COOKIE_ACCES)?.value, new Date())) {
    return NextResponse.next();
  }
  const destination = request.nextUrl.clone();
  destination.pathname = CHEMIN_ACCES;
  destination.search = "";
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/cron|\.well-known|favicon\.ico|icon-192\.png|icon-512\.png|apple-icon\.png|manifest\.webmanifest).*)",
  ],
};
