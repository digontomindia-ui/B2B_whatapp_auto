import { NextRequest, NextResponse } from "next/server";
import { listTemplates, createTemplate } from "@/server/templates/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const variableMappingSchema = z.object({
  type: z.enum(["static", "dynamic"]).default("dynamic"),
  field: z.string().optional(),
  customField: z.string().optional(),
  sample: z.string().optional(),
  fallback: z.string().optional(),
  staticValue: z.string().optional()
});

const createTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "Template name is required")
    .max(512, "Template name is too long")
    .regex(
      /^[a-z0-9_]+$/,
      "Template name can only contain lowercase alphanumeric characters and underscores"
    ),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  language: z.string().min(2, "Language code is required").default("en_US"),
  header: z
    .object({
      type: z
        .enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"])
        .default("NONE"),
      text: z
        .string()
        .max(60, "Header text must be under 60 characters")
        .optional(),
      example: z.array(z.string()).optional(),
      variableMapping: variableMappingSchema.optional()
    })
    .optional(),
  body: z.object({
    text: z
      .string()
      .min(1, "Body text is required")
      .max(1024, "Body text must be under 1024 characters"),
    examples: z.array(z.string()).optional(),
    variableMappings: z.record(z.string(), variableMappingSchema).optional()
  }),
  footer: z
    .object({
      text: z
        .string()
        .max(60, "Footer text must be under 60 characters")
        .optional()
    })
    .optional(),
  buttons: z
    .array(
      z.object({
        type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
        text: z
          .string()
          .min(1, "Button text is required")
          .max(25, "Button text must be under 25 characters"),
        url: z.string().optional(),
        phoneNumber: z.string().optional(),
        example: z.array(z.string()).optional()
      })
    )
    .max(3, "At most 3 buttons can be added")
    .optional()
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.TEMPLATE_VIEW);

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
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to fetch templates";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.TEMPLATE_CREATE);

    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message:
            parsed.error.issues[0]?.message || "Invalid template payload",
          data: null
        },
        { status: 400 }
      );
    }

    const template = await createTemplate(parsed.data);

    return NextResponse.json({
      error: false,
      message: "Template created and submitted to Meta successfully",
      data: template
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 400;
    const msg =
      err instanceof Error ? err.message : "Failed to create template";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
