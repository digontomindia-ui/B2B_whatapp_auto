import { NextRequest, NextResponse } from "next/server";
import { importContactsFromCsv } from "@/server/customers/csv";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";
import Papa from "papaparse";

const importBodySchema = z.object({
  rows: z.array(z.record(z.string(), z.any())).optional(),
  csvContent: z.string().optional(),
  options: z
    .object({
      updateExisting: z.boolean().default(true),
      defaultTag: z.string().optional()
    })
    .default({ updateExisting: true })
});

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.CUSTOMER_IMPORT);
    let rows: Array<Record<string, string>> = [];
    let options = {
      updateExisting: true,
      defaultTag: undefined as string | undefined
    };

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const json = await request.json();
      const parsed = importBodySchema.safeParse(json);
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
        defaultTag: parsed.data.options.defaultTag
      };

      if (parsed.data.rows && parsed.data.rows.length > 0) {
        rows = parsed.data.rows;
      } else if (parsed.data.csvContent) {
        const parsedCsv = Papa.parse<Record<string, string>>(
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
      const defaultTag = (formData.get("defaultTag") as string) || undefined;

      if (!file) {
        return NextResponse.json(
          { error: true, message: "No CSV file provided", data: null },
          { status: 400 }
        );
      }

      const text = await file.text();
      const parsedCsv = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: "greedy"
      });
      rows = parsedCsv.data;
      options = { updateExisting, defaultTag };
    } else {
      const text = await request.text();
      const parsedCsv = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: "greedy"
      });
      rows = parsedCsv.data;
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: true, message: "No contact rows found to import", data: null },
        { status: 400 }
      );
    }

    const result = await importContactsFromCsv(rows, options);

    return NextResponse.json({
      error: false,
      message: `Processed ${result.totalRows} contacts: ${result.createdCount} created, ${result.updatedCount} updated, ${result.errorCount} errors.`,
      data: result
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to import contacts";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
