import { NextRequest, NextResponse } from "next/server";
import { updateCustomer } from "@/server/customers/service";
import prisma from "@/lib/prisma";
import { CustomerState } from "@prisma/client";
import { z } from "zod";

const updateCustomerSchema = z.object({
  customName: z.string().trim().optional().nullable(),
  profilePicUrl: z.string().trim().url().or(z.literal("")).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  state: z.nativeEnum(CustomerState).optional(),
  tags: z.array(z.string()).optional()
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
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
    const msg = err instanceof Error ? err.message : "Customer not found";
    return NextResponse.json({ error: true, message: msg, data: null }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
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
    const msg = err instanceof Error ? err.message : "Failed to update customer";
    return NextResponse.json({ error: true, message: msg, data: null }, { status: 500 });
  }
}
