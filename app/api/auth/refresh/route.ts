import {
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  AUTH_COOKIE_OPTIONS
} from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { refreshSessionFromToken } from "@/server/auth/service";

export async function POST(request: NextRequest) {
  try {
    let refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

    if (!refreshToken) {
      try {
        const body = await request.json();
        if (body && typeof body.refreshToken === "string") {
          refreshToken = body.refreshToken;
        }
      } catch {
        // Request might not have a JSON body
      }
    }

    if (!refreshToken) {
      return NextResponse.json(
        {
          error: true,
          message: "No refresh token provided",
          data: null
        },
        { status: 401 }
      );
    }

    const result = await refreshSessionFromToken(refreshToken);

    if (!result.success || !result.newAccessToken || !result.actor) {
      const response = NextResponse.json(
        {
          error: true,
          message: result.error || "Session expired",
          data: null
        },
        { status: 401 }
      );

      // Invalidate cookies since refresh token is invalid/revoked
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

    const response = NextResponse.json(
      {
        error: false,
        message: "Token refreshed successfully",
        data: {
          actor: result.actor,
          accessToken: result.newAccessToken
        }
      },
      { status: 200 }
    );

    response.cookies.set(
      ACCESS_TOKEN_COOKIE_NAME,
      result.newAccessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS
    );

    return response;
  } catch (error) {
    console.error("Token refresh route error:", error);
    return NextResponse.json(
      {
        error: true,
        message: "Failed to refresh token",
        data: null
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
