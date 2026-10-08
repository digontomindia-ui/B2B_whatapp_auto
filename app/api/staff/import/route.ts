import { NextRequest, NextResponse } from "next/server";
import { importStaffFromCsv } from "@/server/staff/csv";
import { requireOwner } from "@/lib/rbac";
import Papa from "papaparse";
import { z } from "zod";

const importStaffSchema = z.object({
  rows: z.array(z.record(z.string(), z.any())).optional(),
  csvContent: z.string().optional(),
  options: z
    .object({
      updateExisting: z.boolean().default(true),
      defaultRoleName: z.string().optional()
    })
    .default({ updateExisting: true })
});

export async function POST(request: NextRequest) {
  try {
    // Only admin can add/import staff
    await requireOwner(request);

    let rows: Array<Record<string, unknown>> = [];
    let options = {
      updateExisting: true,
      defaultRoleName: undefined as string | undefined
    };

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const json = await request.json();
      const parsed = importStaffSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: true,
            message: parsed.error.issues[0]?.message || "Invalid payload",
            data: null
          },
          { status: 400 }
        );
      }

      options = {
        updateExisting: parsed.data.options.updateExisting,
        defaultRoleName: parsed.data.options.defaultRoleName
      };

      if (parsed.data.rows && parsed.data.rows.length > 0) {
        rows = parsed.data.rows;
      } else if (parsed.data.csvContent) {
        const parsedCsv = Papa.parse<Record<string, unknown>>(
          parsed.data.csvContent,
          {
            header: true,
            skipEmptyLines: "greedy"
          }
        );
        rows = parsedCsv.data;
      }
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const updateExisting = formData.get("updateExisting") !== "false";
      const defaultRoleName =
        (formData.get("defaultRoleName") as string) || undefined;

      if (!file) {
        return NextResponse.json(
          { error: true, message: "No CSV file provided", data: null },
          { status: 400 }
        );
      }

      const text = await file.text();
      const parsedCsv = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: "greedy"
      });
      rows = parsedCsv.data;
      options = { updateExisting, defaultRoleName };
    } else {
      const text = await request.text();
      const parsedCsv = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: "greedy"
      });
      rows = parsedCsv.data;
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: true, message: "No staff rows found in CSV", data: null },
        { status: 400 }
      );
    }

    const result = await importStaffFromCsv(rows, options);

    return NextResponse.json({
      error: false,
      message: `Processed ${result.totalRows} staff records: ${result.createdCount} created, ${result.updatedCount} updated, ${result.errorCount} errors.`,
      data: result
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac ? (err as { statusCode?: number }).statusCode || 403 : 500;
    const msg = err instanceof Error ? err.message : "Failed to import staff";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
