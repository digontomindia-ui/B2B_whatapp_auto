import { NextRequest, NextResponse } from "next/server";
import { signUpSchema } from "@/lib/validation/auth";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import {
  hashPassword,
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
    const result = signUpSchema.safeParse(body);

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

    const { email, name, password } = result.data;

    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingAdmin) {
      return NextResponse.json(
        {
          error: true,
          message: "Admin already registered",
          data: null
        },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const tokenId = crypto.randomUUID();

    const admin = await prisma.admin.create({
      data: {
        email,
        name,

        credential: {
          create: {
            passwordHash
          }
        },

        tokens: {
          create: {
            id: tokenId
          }
        }
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    const accessToken = generateAccessToken(admin.id);
    const refreshToken = generateRefreshToken(admin.id, tokenId);

    const response = NextResponse.json(
      {
        error: false,
        message: "Admin registered successfully",
        data: admin
      },
      { status: 201 }
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
    console.error("Sign up error:", error);

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
