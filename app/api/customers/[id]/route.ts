import { NextRequest, NextResponse } from "next/server";
import { updateCustomer, deleteCustomer } from "@/server/customers/service";
import prisma from "@/lib/prisma";
import { CustomerState } from "@prisma/client";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const updateCustomerSchema = z.object({
  customName: z.string().trim().optional().nullable(),
  profilePicUrl: z
    .string()
    .trim()
    .url()
    .or(z.literal(""))
    .optional()
    .nullable(),
  notes: z.string().trim().optional().nullable(),
  state: z.nativeEnum(CustomerState).optional(),
  tags: z.array(z.string()).optional()
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.CUSTOMER_VIEW);

    const { id } = await context.params;
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        conversations: {
          take: 1,
          orderBy: { createdAt: "desc" }
        }
      }
    });

    return NextResponse.json({
      error: false,
      message: "Customer retrieved",
      data: customer
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 404;
    const msg = err instanceof Error ? err.message : "Customer not found";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.CUSTOMER_EDIT);

    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid update data",
          data: null
        },
        { status: 400 }
      );
    }

    const updated = await updateCustomer(id, parsed.data);

    return NextResponse.json({
      error: false,
      message: "Customer updated successfully",
      data: updated
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 400;
    const msg =
      err instanceof Error ? err.message : "Failed to update customer";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.CUSTOMER_DELETE);

    const { id } = await context.params;
    const deleted = await deleteCustomer(id);

    return NextResponse.json({
      error: false,
      message: "Customer and all associated records deleted successfully",
      data: { id: deleted.id, phone: deleted.normalizedPhone }
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 400;
    const msg =
      err instanceof Error ? err.message : "Failed to delete customer";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
