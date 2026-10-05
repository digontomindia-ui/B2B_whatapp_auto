import { NextRequest, NextResponse } from "next/server";
import { getAdminId } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const adminId = getAdminId(request);

    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
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

    return NextResponse.json({
      error: false,
      message: "Profile retrieved successfully",
      data: admin
    });
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
