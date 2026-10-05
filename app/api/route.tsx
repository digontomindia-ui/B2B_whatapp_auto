import { NextResponse, NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      error: false,
      message: "Healthy",
      data: { time: Date.now() }
    },
    { status: 200 }
  );
}
