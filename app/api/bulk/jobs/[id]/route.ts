import { NextRequest, NextResponse } from "next/server";
import { getBulkJob } from "@/server/bulk/service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const job = await getBulkJob(id);

    return NextResponse.json({
      error: false,
      message: "Bulk job retrieved",
      data: job
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bulk job not found";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status: 404 }
    );
  }
}
