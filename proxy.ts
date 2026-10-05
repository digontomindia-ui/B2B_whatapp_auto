import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_ID_HEADER,
  verifyAccessToken,
  ACCESS_TOKEN_COOKIE_NAME
} from "@/lib/auth";

export function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;

  if (!accessToken) {
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
  headers.set(ADMIN_ID_HEADER, payload.adminId);

  return NextResponse.next({
    request: { headers }
  });
}

export const config = {
  matcher: "/api/main/:path*"
};
