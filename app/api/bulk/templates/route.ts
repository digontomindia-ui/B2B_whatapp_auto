import { NextRequest, NextResponse } from "next/server";
import { createBulkMessageJob } from "@/server/bulk/service";
import { z } from "zod";

const bulkTemplateSchema = z.object({
  title: z.string().optional(),
  templateId: z.string().optional(),
  templateName: z.string().min(1, "Template name is required"),
  language: z.string().default("en"),
  components: z.array(z.any()).default([]),
  customerIds: z.array(z.string().uuid()).min(1, "At least one recipient is required"),
  allowOverrideBlocked: z.boolean().default(false)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bulkTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid bulk template payload",
          data: null
        },
        { status: 400 }
      );
    }

    const result = await createBulkMessageJob({
      type: "TEMPLATE",
      title: parsed.data.title,
      templateId: parsed.data.templateId,
      templateName: parsed.data.templateName,
      language: parsed.data.language,
      components: parsed.data.components,
      customerIds: parsed.data.customerIds,
      allowOverrideBlocked: parsed.data.allowOverrideBlocked
    });

    return NextResponse.json({
      error: false,
      message: "Bulk template broadcast initiated",
      data: result
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to initiate bulk template broadcast";
    return NextResponse.json({ error: true, message: msg, data: null }, { status: 500 });
  }
}
