import {
  ADMIN_ID_HEADER,
  STAFF_ID_HEADER,
  ACTOR_TYPE_HEADER,
  verifyAccessToken,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME
} from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

  if (!accessToken) {
    // If refreshToken exists, allow the downstream route handler to perform transparent refresh
    if (refreshToken) {
      return NextResponse.next();
    }

    return NextResponse.json(
      {
        error: true,
        message: "Unauthorized",
        data: null
      },
      { status: 401 }
    );
  }

  const payload = verifyAccessToken(accessToken);

  if (!payload) {
    // If accessToken is expired/invalid but refreshToken exists, let downstream route refresh
    if (refreshToken) {
      return NextResponse.next();
    }

    return NextResponse.json(
      {
        error: true,
        message: "Unauthorized",
        data: null
      },
      { status: 401 }
    );
  }

  const headers = new Headers(request.headers);
  if (payload.adminId) {
    headers.set(ADMIN_ID_HEADER, payload.adminId);
  }
  if (payload.staffId) {
    headers.set(STAFF_ID_HEADER, payload.staffId);
  }
  headers.set(ACTOR_TYPE_HEADER, payload.actorType || "admin");

  return NextResponse.next({
    request: { headers }
  });
}

export const config = {
  matcher: "/api/main/:path*"
};
