import prisma from "@/lib/prisma";
import { normalizePhoneNumber, extractCountryCode } from "@/utils/phone";
import { realtimeBroadcaster } from "@/server/realtime/broadcaster";
import { CustomerState } from "@prisma/client";

export interface FindOrCreateCustomerInput {
  phone: string;
  whatsappName?: string | null;
  customName?: string | null;
  profilePicUrl?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface CustomerFilterParams {
  search?: string;
  dateRange?: "all" | "today" | "yesterday" | "last7days" | "last30days" | "custom";
  startDate?: string;
  endDate?: string;
  communicationState?: "all" | "unread" | "read" | "blocked" | "opted_out" | "active" | "has_conversation" | "failed";
  sort?: "newest_interaction" | "oldest_interaction" | "newest_customer" | "oldest_customer";
  tag?: string;
  page?: number;
  limit?: number;
}

export async function findOrCreateCustomerByPhone({
  phone,
  whatsappName,
  customName,
  profilePicUrl,
  notes,
  tags = []
}: FindOrCreateCustomerInput) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    throw new Error("Invalid phone number provided");
  }

  // Check if customer already exists by normalized phone
  const existing = await prisma.customer.findUnique({
    where: { normalizedPhone: normalized },
    include: {
      tags: { include: { tag: true } },
      conversations: { take: 1, orderBy: { createdAt: "desc" } }
    }
  });

  if (existing) {
    // Determine updates: do NOT overwrite customName with whatsappName
    const dataToUpdate: Record<string, unknown> = {};

    if (whatsappName && whatsappName !== existing.whatsappName) {
      dataToUpdate.whatsappName = whatsappName;
    }
    if (customName && customName !== existing.customName) {
      dataToUpdate.customName = customName;
    }
    if (profilePicUrl && profilePicUrl !== existing.profilePicUrl) {
      dataToUpdate.profilePicUrl = profilePicUrl;
    }
    if (notes !== undefined && notes !== null && notes !== existing.notes) {
      dataToUpdate.notes = notes;
    }

    let updated = existing;
    if (Object.keys(dataToUpdate).length > 0) {
      updated = await prisma.customer.update({
        where: { id: existing.id },
        data: dataToUpdate,
        include: {
          tags: { include: { tag: true } },
          conversations: { take: 1, orderBy: { createdAt: "desc" } }
        }
      });
      realtimeBroadcaster.broadcast("CUSTOMER_UPDATED", updated);
    }

    // Connect any additional tags if provided
    if (tags.length > 0) {
      for (const tagName of tags) {
        const cleanTag = tagName.trim();
        if (!cleanTag) continue;
        const tagRecord = await prisma.tag.upsert({
          where: { name: cleanTag },
          create: { name: cleanTag },
          update: {}
        });
        await prisma.customerTag.upsert({
          where: {
            customerId_tagId: {
              customerId: existing.id,
              tagId: tagRecord.id
            }
          },
          create: {
            customerId: existing.id,
            tagId: tagRecord.id
          },
          update: {}
        });
      }
    }

    // Ensure conversation exists
    if (!existing.conversations || existing.conversations.length === 0) {
      await prisma.conversation.create({
        data: { customerId: existing.id }
      });
    }

    return updated;
  }

  // Create new customer
  const countryCode = extractCountryCode(normalized);

  const newCustomer = await prisma.$transaction(async (tx) => {
    const cust = await tx.customer.create({
      data: {
        phoneNumber: phone.trim(),
        normalizedPhone: normalized,
        whatsappName: whatsappName || null,
        customName: customName || null,
        profilePicUrl: profilePicUrl || null,
        countryCode,
        notes: notes || null,
        conversations: {
          create: {}
        }
      },
      include: {
        tags: { include: { tag: true } },
        conversations: { take: 1 }
      }
    });

    if (tags.length > 0) {
      for (const tagName of tags) {
        const cleanTag = tagName.trim();
        if (!cleanTag) continue;
        const tagRecord = await tx.tag.upsert({
          where: { name: cleanTag },
          create: { name: cleanTag },
          update: {}
        });
        await tx.customerTag.create({
          data: {
            customerId: cust.id,
            tagId: tagRecord.id
          }
        });
      }
    }

    return cust;
  });

  realtimeBroadcaster.broadcast("CUSTOMER_CREATED", newCustomer);
  return newCustomer;
}

export async function listCustomers(params: CustomerFilterParams = {}) {
  const {
    search,
    dateRange = "all",
    startDate,
    endDate,
    communicationState = "all",
    sort = "newest_interaction",
    tag,
    page = 1,
    limit = 50
  } = params;

  // Build Prisma where clause
  const where: Record<string, unknown> = {};

  // 1. Search across normalizedPhone, customName, whatsappName
  if (search && search.trim()) {
    const q = search.trim();
    const cleanDigits = q.replace(/\D/g, "");
    where.OR = [
      { customName: { contains: q, mode: "insensitive" } },
      { whatsappName: { contains: q, mode: "insensitive" } },
      { normalizedPhone: { contains: cleanDigits || q } }
    ];
  }

  // 2. Date filters against lastInteractionAt or createdAt
  const now = new Date();
  if (dateRange === "today") {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    where.lastInteractionAt = { gte: todayStart };
  } else if (dateRange === "yesterday") {
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    where.lastInteractionAt = { gte: yesterdayStart, lt: yesterdayEnd };
  } else if (dateRange === "last7days") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    where.lastInteractionAt = { gte: sevenDaysAgo };
  } else if (dateRange === "last30days") {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    where.lastInteractionAt = { gte: thirtyDaysAgo };
  } else if (dateRange === "custom" && (startDate || endDate)) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.lastInteractionAt = dateFilter;
  }

  // 3. Communication state filter
  if (communicationState === "unread") {
    where.unreadCount = { gt: 0 };
  } else if (communicationState === "read") {
    where.unreadCount = 0;
  } else if (communicationState === "blocked") {
    where.state = CustomerState.BLOCKED;
  } else if (communicationState === "opted_out") {
    where.state = CustomerState.OPTED_OUT;
  } else if (communicationState === "active") {
    where.state = CustomerState.ACTIVE;
  } else if (communicationState === "has_conversation") {
    where.messages = { some: {} };
  } else if (communicationState === "failed") {
    where.messages = { some: { status: "FAILED" } };
  }

  // 4. Tag filter
  if (tag && tag.trim()) {
    where.tags = {
      some: {
        tag: {
          name: { equals: tag.trim(), mode: "insensitive" }
        }
      }
    };
  }

  // 5. Sorting
  const orderBy: Array<Record<string, "asc" | "desc">> = [];
  if (sort === "newest_interaction") {
    orderBy.push({ lastInteractionAt: "desc" });
    orderBy.push({ createdAt: "desc" });
  } else if (sort === "oldest_interaction") {
    orderBy.push({ lastInteractionAt: "asc" });
    orderBy.push({ createdAt: "asc" });
  } else if (sort === "newest_customer") {
    orderBy.push({ createdAt: "desc" });
  } else if (sort === "oldest_customer") {
    orderBy.push({ createdAt: "asc" });
  }

  const skip = (page - 1) * limit;

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        tags: { include: { tag: true } },
        conversations: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { id: true }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            body: true,
            type: true,
            direction: true,
            status: true,
            createdAt: true
          }
        }
      }
    })
  ]);

  return {
    customers,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

export async function updateCustomer(
  id: string,
  data: {
    customName?: string | null;
    profilePicUrl?: string | null;
    notes?: string | null;
    state?: CustomerState;
    tags?: string[];
  }
) {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id } });

  const updatePayload: Record<string, unknown> = {};
  if (data.customName !== undefined) updatePayload.customName = data.customName;
  if (data.profilePicUrl !== undefined) updatePayload.profilePicUrl = data.profilePicUrl;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.state !== undefined) updatePayload.state = data.state;

  const updated = await prisma.customer.update({
    where: { id },
    data: updatePayload,
    include: {
      tags: { include: { tag: true } },
      conversations: { take: 1, orderBy: { createdAt: "desc" } }
    }
  });

  if (data.tags !== undefined) {
    // Replace tags
    await prisma.customerTag.deleteMany({ where: { customerId: id } });
    for (const tagName of data.tags) {
      const clean = tagName.trim();
      if (!clean) continue;
      const t = await prisma.tag.upsert({
        where: { name: clean },
        create: { name: clean },
        update: {}
      });
      await prisma.customerTag.create({
        data: { customerId: id, tagId: t.id }
      });
    }
  }

  const finalCustomer = await prisma.customer.findUniqueOrThrow({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      conversations: { take: 1, orderBy: { createdAt: "desc" } }
    }
  });

  realtimeBroadcaster.broadcast("CUSTOMER_UPDATED", finalCustomer);
  return finalCustomer;
}
