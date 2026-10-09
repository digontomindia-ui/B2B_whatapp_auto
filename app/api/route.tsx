import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: false,
      message: "Healthy",
      data: { time: Date.now() }
    },
    { status: 200 }
  );
}
