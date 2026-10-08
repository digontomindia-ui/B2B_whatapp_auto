import { NextRequest, NextResponse } from "next/server";
import {
  exportContactsToCsv,
  EXPORTABLE_COLUMNS,
  type ExportOptions
} from "@/server/customers/csv";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const exportSchema = z.object({
  customerIds: z.array(z.string()).optional(),
  filterParams: z
    .object({
      search: z.string().optional(),
      dateRange: z.string().optional(),
      communicationState: z.string().optional(),
      tag: z.string().optional()
    })
    .optional(),
  columns: z.array(z.string()).optional()
});

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.CUSTOMER_EXPORT);
    const body = await request.json().catch(() => ({}));
    const parsed = exportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message:
            parsed.error.issues[0]?.message || "Invalid export parameters",
          data: null
        },
        { status: 400 }
      );
    }

    const { csv, filename } = await exportContactsToCsv(
      parsed.data as ExportOptions
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache"
      }
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac ? (err as { statusCode?: number }).statusCode || 403 : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to export contacts";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function GET() {
  // Return available export columns metadata so UI knows all options
  return NextResponse.json({
    error: false,
    message: "Export metadata",
    data: {
      columns: Object.entries(EXPORTABLE_COLUMNS).map(([key, label]) => ({
        key,
        label,
        defaultSelected: true
      }))
    }
  });
}
