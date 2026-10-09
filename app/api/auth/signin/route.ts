import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS
} from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { signInSchema } from "@/lib/validation/auth";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { ALL_PERMISSIONS } from "@/lib/permissions";

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
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check Admin Account first
    const admin = await prisma.admin.findUnique({
      where: { email: cleanEmail },
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

    if (admin?.credential) {
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

      const accessToken = generateAccessToken({
        adminId: admin.id,
        actorType: "admin",
        email: admin.email,
        name: admin.name,
        roleName: "Administrator",
        permissions: ALL_PERMISSIONS
      });

      const refreshToken = generateRefreshToken({
        adminId: admin.id,
        actorType: "admin",
        tokenId
      });

      const response = NextResponse.json(
        {
          error: false,
          message: "Signed in successfully",
          data: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            isOwner: true,
            roleName: "Administrator",
            permissions: ALL_PERMISSIONS
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
    }

    // 2. Check Staff Account
    const staff = await prisma.staff.findUnique({
      where: { email: cleanEmail },
      include: {
        role: true
      }
    });

    if (staff) {
      if (!staff.isActive) {
        return NextResponse.json(
          {
            error: true,
            message:
              "Account has been deactivated. Please contact an Administrator.",
            data: null
          },
          { status: 403 }
        );
      }

      const validPassword = await verifyPassword(password, staff.passwordHash);

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

      await prisma.staffToken.create({
        data: {
          id: tokenId,
          staffId: staff.id
        }
      });

      const accessToken = generateAccessToken({
        staffId: staff.id,
        actorType: "staff",
        email: staff.email,
        name: staff.name,
        roleId: staff.role.id,
        roleName: staff.role.name,
        permissions: staff.role.permissions
      });

      const refreshToken = generateRefreshToken({
        staffId: staff.id,
        actorType: "staff",
        tokenId
      });

      const response = NextResponse.json(
        {
          error: false,
          message: "Signed in successfully",
          data: {
            id: staff.id,
            email: staff.email,
            name: staff.name,
            phone: staff.phone,
            isOwner: false,
            roleName: staff.role.name,
            permissions: staff.role.permissions
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
    }

    // No admin or staff found
    return NextResponse.json(
      {
        error: true,
        message: "Invalid email or password",
        data: null
      },
      { status: 401 }
    );
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
