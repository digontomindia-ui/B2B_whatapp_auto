import {
  getDistributionStats,
  autoDistributeCustomers,
  manualQuotaDistributeCustomers,
  assignCustomersDirectly
} from "@/server/customers/distribution";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const distributeSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("AUTO"),
    staffIds: z.array(z.string()).optional(),
    onlyUnassigned: z.boolean().default(true)
  }),
  z.object({
    mode: z.literal("MANUAL_COUNTS"),
    allocations: z.array(
      z.object({
        staffId: z.string(),
        count: z.number().int().nonnegative()
      })
    ),
    onlyUnassigned: z.boolean().default(true)
  }),
  z.object({
    mode: z.literal("MANUAL_DIRECT"),
    customerIds: z.array(z.string()).min(1),
    staffId: z.string().nullable()
  })
]);

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.CUSTOMER_ASSIGN);
    const stats = await getDistributionStats();

    return NextResponse.json({
      error: false,
      message: "Distribution stats fetched successfully",
      data: stats
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to fetch distribution stats";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.CUSTOMER_ASSIGN);
    const body = await request.json();
    const parsed = distributeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message:
            parsed.error.issues[0]?.message || "Invalid distribution payload",
          data: null
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    if (payload.mode === "AUTO") {
      const result = await autoDistributeCustomers({
        staffIds: payload.staffIds,
        onlyUnassigned: payload.onlyUnassigned
      });

      return NextResponse.json({
        error: false,
        message: `Successfully auto-distributed ${result.totalDistributed} customers`,
        data: result
      });
    } else if (payload.mode === "MANUAL_COUNTS") {
      const result = await manualQuotaDistributeCustomers({
        allocations: payload.allocations,
        onlyUnassigned: payload.onlyUnassigned
      });

      return NextResponse.json({
        error: false,
        message: `Successfully distributed ${result.totalDistributed} customers by manual quotas`,
        data: result
      });
    } else if (payload.mode === "MANUAL_DIRECT") {
      const result = await assignCustomersDirectly({
        customerIds: payload.customerIds,
        staffId: payload.staffId
      });

      return NextResponse.json({
        error: false,
        message: `Updated assigned staff for ${result.count} customers`,
        data: result
      });
    }

    return NextResponse.json(
      { error: true, message: "Unsupported distribution mode", data: null },
      { status: 400 }
    );
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error
        ? err.message
        : "Failed to execute customer distribution";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
