import { NextRequest, NextResponse } from "next/server";
import { listTemplates } from "@/server/templates/service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;

    const templates = await listTemplates({ status, category, search });

    return NextResponse.json({
      error: false,
      message: "Templates retrieved successfully",
      data: templates
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch templates";
    return NextResponse.json({ error: true, message: msg, data: null }, { status: 500 });
  }
}
