import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const email = body.email;
  const password = body.password;

  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return NextResponse.json({
      error: true,
      message: "Email and password is required"
    });
  }

  const admin = await prisma.admin.findFirst({
    where: {
      email: email
    }
  });
  if (!admin) {
    return NextResponse.json({
      error: true,
      message: "No Registered"
    });
  }
  // TODO: check password here
  const isValidPassword = true;

  if (!isValidPassword) {
    return NextResponse.json({
      error: true,
      message: "Incorrect password"
    });
  }

  // TODO: create tokens
  const accessToken: string = "";
  const refreshToken: string = "";

  // TODO: set the cookie here

  return NextResponse.json(
    {
      error: false,
      message: "Healthy ss",
      data: { accessToken, refreshToken }
    },
    { status: 200 }
  );
}
