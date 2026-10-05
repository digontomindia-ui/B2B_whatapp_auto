import { NextResponse } from "next/server";
import { syncTemplatesFromMeta } from "@/server/templates/service";

export async function POST() {
  try {
    const templates = await syncTemplatesFromMeta();

    return NextResponse.json({
      error: false,
      message: `Successfully synchronized ${templates.length} templates from Meta`,
      data: templates
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to sync templates from Meta";
    return NextResponse.json({ error: true, message: msg, data: null }, { status: 500 });
  }
}
