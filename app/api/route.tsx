import { NextResponse, NextRequest } from "next/server";
import { DATABASE_URL } from "@/lib/env";

export interface Data {
  id: number;
  name: string;
}

const data: Array<Data> = Array.from({ length: 50 }, (_, index) => ({
  id: index,
  name: `Item ${index}`
}));

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const page: number = Number(searchParams.get("page") ?? 1);
  const limit: number = Number(searchParams.get("limit") ?? 3);

  const results = data.slice((page - 1) * limit, page * limit);

  return NextResponse.json(
    {
      error: false,
      message: "Healthy ss",
      data: { DATABASE_URL }
    },
    { status: 200 }
  );
}
