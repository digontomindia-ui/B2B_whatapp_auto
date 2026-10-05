import { NextResponse, NextRequest } from "next/server";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import {
  verifyPassword,
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

    const email = body.email;
    const password = body.password;

    if (
      !email ||
      !password ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return NextResponse.json(
        {
          error: true,
          message: "Email and password is required",
          data: null
        },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    const admin = await prisma.admin.findUnique({
      where: {
        email: trimmedEmail
      }
    });

    if (!admin) {
      return NextResponse.json(
        {
          error: true,
          message: "No Registered",
          data: null
        },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, admin.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        {
          error: true,
          message: "Incorrect password",
          data: null
        },
        { status: 401 }
      );
    }

    // Automatically upgrade legacy plain-text password to bcrypt hash
    if (
      !admin.passwordHash.startsWith("$2a$") &&
      !admin.passwordHash.startsWith("$2b$") &&
      !admin.passwordHash.startsWith("$2y$")
    ) {
      const newHash = await hashPassword(password);
      await prisma.admin.update({
        where: { id: admin.id },
        data: { passwordHash: newHash }
      });
    }

    // Create a new session token record in the database
    const tokenId = crypto.randomUUID();
    await prisma.token.create({
      data: {
        id: tokenId,
        adminId: admin.id
      }
    });

    // Create JWT tokens
    const accessToken = generateAccessToken(admin.id);
    const refreshToken = generateRefreshToken(admin.id, tokenId);

    const response = NextResponse.json(
      {
        error: false,
        message: "Sign in successful",
        data: {
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name
          },
          accessToken,
          refreshToken
        }
      },
      { status: 200 }
    );

    // Set secure HTTP-only cookies
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
    console.error("Sign-in error:", error);
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
