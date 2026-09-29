import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json<ResponseData>(
    { error: false, message: "Healthy", data: null },
    { status: 200 }
  );
}
