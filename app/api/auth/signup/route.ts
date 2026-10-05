import { NextResponse, NextRequest } from "next/server";
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

    const email = body.email;
    const password = body.password;
    const name = body.name;

    if (
      !email ||
      !password ||
      !name ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof name !== "string"
    ) {
      return NextResponse.json(
        {
          error: true,
          message: "Email, password and name is required",
          data: null
        },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      return NextResponse.json(
        {
          error: true,
          message: "Name cannot be empty",
          data: null
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error: true,
          message: "Password must be at least 6 characters long",
          data: null
        },
        { status: 400 }
      );
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: {
        email: trimmedEmail
      }
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

    // Hash password with bcrypt
    const hashedPassword = await hashPassword(password);

    const newAdmin = await prisma.admin.create({
      data: {
        email: trimmedEmail,
        name: trimmedName,
        passwordHash: hashedPassword
      }
    });

    // Create session token record in database
    const tokenId = crypto.randomUUID();
    await prisma.token.create({
      data: {
        id: tokenId,
        adminId: newAdmin.id
      }
    });

    // Generate JWT tokens
    const accessToken = generateAccessToken(newAdmin.id);
    const refreshToken = generateRefreshToken(newAdmin.id, tokenId);

    const response = NextResponse.json(
      {
        error: false,
        message: "Admin registered successfully",
        data: {
          id: newAdmin.id,
          email: newAdmin.email,
          name: newAdmin.name,
          accessToken,
          refreshToken
        }
      },
      { status: 201 }
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
    console.error("Sign-up error:", error);
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
