import { NextRequest, NextResponse } from "next/server";
import { createBulkMessageJob } from "@/server/bulk/service";
import { z } from "zod";

const bulkMessageSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1, "Message content cannot be empty"),
  customerIds: z.array(z.string().uuid()).min(1, "At least one recipient is required"),
  allowOverrideBlocked: z.boolean().default(false)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bulkMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid bulk message payload",
          data: null
        },
        { status: 400 }
      );
    }

    const result = await createBulkMessageJob({
      type: "MESSAGE",
      title: parsed.data.title,
      content: parsed.data.content,
      customerIds: parsed.data.customerIds,
      allowOverrideBlocked: parsed.data.allowOverrideBlocked
    });

    return NextResponse.json({
      error: false,
      message: "Bulk message broadcast initiated",
      data: result
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to initiate bulk broadcast";
    return NextResponse.json({ error: true, message: msg, data: null }, { status: 500 });
  }
}
