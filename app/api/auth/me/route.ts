import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAccessToken, ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
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
    if (!payload?.adminId) {
      return NextResponse.json(
        {
          error: true,
          message: "Unauthorized or expired token",
          data: null
        },
        { status: 401 }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    if (!admin) {
      return NextResponse.json(
        {
          error: true,
          message: "Admin not found",
          data: null
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: false,
        message: "Profile retrieved successfully",
        data: { admin }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get me error:", error);
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
