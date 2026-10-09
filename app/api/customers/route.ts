import { NextRequest, NextResponse } from "next/server";
import {
  listCustomers,
  findOrCreateCustomerByPhone
} from "@/server/customers/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const createCustomerSchema = z.object({
  phone: z.string().min(6, "Valid phone number is required"),
  customName: z.string().trim().optional().nullable(),
  whatsappName: z.string().trim().optional().nullable(),
  profilePicUrl: z
    .string()
    .trim()
    .url()
    .or(z.literal(""))
    .optional()
    .nullable(),
  notes: z.string().trim().optional().nullable(),
  tags: z.array(z.string()).optional()
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission(request, PERMISSIONS.CUSTOMER_VIEW);

    const { searchParams } = new URL(request.url);

    let assignedStaffId = searchParams.get("assignedStaffId") || undefined;
    if (actor.actorType === "staff" && !actor.isOwner) {
      assignedStaffId = actor.id;
    }

    const search = searchParams.get("search") || undefined;
    const dateRange = (searchParams.get("dateRange") || "all") as
      "all" | "today" | "yesterday" | "last7days" | "last30days" | "custom";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const communicationState = (searchParams.get("communicationState") ||
      "all") as
      | "all"
      | "unread"
      | "read"
      | "blocked"
      | "opted_out"
      | "active"
      | "has_conversation"
      | "failed";
    const sort = (searchParams.get("sort") || "newest_interaction") as
      | "newest_interaction"
      | "oldest_interaction"
      | "newest_customer"
      | "oldest_customer";
    const tag = searchParams.get("tag") || undefined;
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(
      1,
      Math.min(100, Number(searchParams.get("limit") || 50))
    );

    const result = await listCustomers({
      search,
      dateRange,
      startDate,
      endDate,
      communicationState,
      sort,
      tag,
      assignedStaffId,
      page,
      limit
    });

    return NextResponse.json({
      error: false,
      message: "Customers fetched successfully",
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
      err instanceof Error ? err.message : "Failed to fetch customers";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.CUSTOMER_CREATE);

    const body = await request.json();
    const parsed = createCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid customer input",
          data: null
        },
        { status: 400 }
      );
    }

    const customer = await findOrCreateCustomerByPhone(parsed.data);

    return NextResponse.json(
      {
        error: false,
        message: "Customer created/retrieved successfully",
        data: customer
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to create customer";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
