import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const email = body.email;
  const password = body.password;
  const name = body.name;

  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof name !== "string"
  ) {
    return NextResponse.json({
      error: true,
      message: "Email, password and name is required"
    });
  }

  const existingAdmin = await prisma.admin.findFirst({
    where: {
      email: email
    }
  });

  if (existingAdmin) {
    return NextResponse.json({
      error: true,
      message: "Admin already registered"
    });
  }

  // TODO: hash password before storing
  // const hashedPassword = await bcrypt.hash(password, 10);
  const hashedPassword = password;

  const newAdmin = await prisma.admin.create({
    data: {
      email: email,
      name: name,
      passwordHash: hashedPassword
    }
  });

  // TODO: create tokens
  const accessToken: string = "";
  const refreshToken: string = "";

  // TODO: set the cookie here

  return NextResponse.json(
    {
      error: false,
      message: "Admin registered successfully",
      data: {
        id: newAdmin.id,
        email: newAdmin.email,
        accessToken,
        refreshToken
      }
    },
    { status: 201 }
  );
}
