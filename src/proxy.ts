import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /api/uploads: require session cookie
  if (pathname.startsWith("/api/uploads")) {
    const sessionCookie = request.cookies.get("ticketlink_session");
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: "Unauthorized: Sesi log masuk diperlukan untuk mengakses fail ini." },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/uploads/:path*",
  ],
};
