import { NextRequest, NextResponse } from "next/server";
import { signInSchema } from "@/lib/validation/auth";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = signInSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: true,
          message: result.error.issues[0].message,
          data: null
        },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    const admin = await prisma.admin.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        credential: {
          select: {
            passwordHash: true
          }
        }
      }
    });

    if (!admin?.credential) {
      return NextResponse.json(
        {
          error: true,
          message: "Invalid email or password",
          data: null
        },
        { status: 401 }
      );
    }

    const validPassword = await verifyPassword(
      password,
      admin.credential.passwordHash
    );

    if (!validPassword) {
      return NextResponse.json(
        {
          error: true,
          message: "Invalid email or password",
          data: null
        },
        { status: 401 }
      );
    }

    const tokenId = crypto.randomUUID();

    await prisma.token.create({
      data: {
        id: tokenId,
        adminId: admin.id
      }
    });

    const accessToken = generateAccessToken(admin.id);
    const refreshToken = generateRefreshToken(admin.id, tokenId);

    const response = NextResponse.json(
      {
        error: false,
        message: "Signed in successfully",
        data: {
          id: admin.id,
          email: admin.email,
          name: admin.name
        }
      },
      { status: 200 }
    );

    response.cookies.set(
      ACCESS_TOKEN_COOKIE_NAME,
      accessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS
    );

    response.cookies.set(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS
    );

    return response;
  } catch (error) {
    console.error("Sign in error:", error);

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
