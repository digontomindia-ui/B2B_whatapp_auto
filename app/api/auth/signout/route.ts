import {
  verifyRefreshToken,
  AUTH_COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME
} from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);

        if (payload?.tokenId) {
          if (payload.adminId || payload.actorType === "admin") {
            await prisma.token
              .deleteMany({
                where: { id: payload.tokenId }
              })
              .catch(() => {});
          } else if (payload.staffId || payload.actorType === "staff") {
            await prisma.staffToken
              .deleteMany({
                where: { id: payload.tokenId }
              })
              .catch(() => {});
          }
        }
      } catch {
        // Token is invalid/expired. Still clear cookies.
      }
    }

    const response = NextResponse.json(
      {
        error: false,
        message: "Logged out successfully",
        data: null
      },
      { status: 200 }
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "", {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 0
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, "", {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 0
    });

    return response;
  } catch (error) {
    console.error("Sign out error:", error);

    return NextResponse.json(
      {
        error: true,
        message: "Internal server error",
        data: null
      },
      { status: 500 }
    );
  }
}
