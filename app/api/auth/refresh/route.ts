import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyRefreshToken,
  generateAccessToken,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  AUTH_COOKIE_OPTIONS
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        {
          error: true,
          message: "Refresh token is missing",
          data: null
        },
        { status: 401 }
      );
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload?.adminId || !payload?.tokenId) {
      // Invalid token, clear cookies
      const response = NextResponse.json(
        {
          error: true,
          message: "Invalid refresh token",
          data: null
        },
        { status: 401 }
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
    }

    // Verify token exists in database
    const tokenRecord = await prisma.token.findFirst({
      where: {
        id: payload.tokenId,
        adminId: payload.adminId
      }
    });

    if (!tokenRecord) {
      const response = NextResponse.json(
        {
          error: true,
          message: "Session revoked or expired",
          data: null
        },
        { status: 401 }
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
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(payload.adminId);

    const response = NextResponse.json(
      {
        error: false,
        message: "Token refreshed successfully",
        data: {
          accessToken: newAccessToken
        }
      },
      { status: 200 }
    );

    response.cookies.set(
      ACCESS_TOKEN_COOKIE_NAME,
      newAccessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS
    );

    return response;
  } catch (error) {
    console.error("Refresh token error:", error);
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
