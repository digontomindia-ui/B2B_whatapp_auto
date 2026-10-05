import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyRefreshToken,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

    if (refreshToken) {
      const payload = verifyRefreshToken(refreshToken);
      if (payload?.tokenId) {
        await prisma.token
          .deleteMany({
            where: {
              id: payload.tokenId
            }
          })
          .catch(() => {});
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

    // Clear authentication cookies
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
    console.error("Sign-out error:", error);
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
