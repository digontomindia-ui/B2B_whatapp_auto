import { normalizePhoneNumber, extractCountryCode } from "@/utils/phone";
import prisma from "@/lib/prisma";
import { realtimeBroadcaster } from "@/server/realtime/broadcaster";
import { CustomerState, CustomerStatus } from "@prisma/client";

export interface FindOrCreateCustomerInput {
  phone: string;
  whatsappName?: string | null;
  customName?: string | null;
  companyName?: string | null;
  address?: string | null;
  profilePicUrl?: string | null;
  notes?: string | null;
  status?: CustomerStatus;
  groupId?: string | null;
  tags?: string[];
}

export interface CustomerFilterParams {
  search?: string;
  status?: CustomerStatus | "all";
  groupId?: string | "all";
  dateRange?:
    "all" | "today" | "yesterday" | "last7days" | "last30days" | "custom";
  startDate?: string;
  endDate?: string;
  communicationState?:
    | "all"
    | "unread"
    | "read"
    | "blocked"
    | "opted_out"
    | "active"
    | "has_conversation"
    | "failed";
  sort?:
    | "newest_interaction"
    | "oldest_interaction"
    | "newest_customer"
    | "oldest_customer";
  tag?: string;
  assignedStaffId?: string | null;
  page?: number;
  limit?: number;
}

export async function findOrCreateCustomerByPhone({
  phone,
  whatsappName,
  customName,
  companyName,
  address,
  profilePicUrl,
  notes,
  status,
  groupId,
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
      group: { select: { id: true, name: true, color: true } },
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
    if (companyName && companyName !== existing.companyName) {
      dataToUpdate.companyName = companyName;
    }
    if (address && address !== existing.address) {
      dataToUpdate.address = address;
    }
    if (profilePicUrl && profilePicUrl !== existing.profilePicUrl) {
      dataToUpdate.profilePicUrl = profilePicUrl;
    }
    if (notes !== undefined && notes !== null && notes !== existing.notes) {
      dataToUpdate.notes = notes;
    }
    if (status && status !== existing.status) {
      dataToUpdate.status = status;
    }
    if (groupId !== undefined && groupId !== existing.groupId) {
      dataToUpdate.groupId = groupId;
    }

    let updated = existing;
    if (Object.keys(dataToUpdate).length > 0) {
      updated = await prisma.customer.update({
        where: { id: existing.id },
        data: dataToUpdate,
        include: {
          group: { select: { id: true, name: true, color: true } },
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
        companyName: companyName || null,
        address: address || null,
        profilePicUrl: profilePicUrl || null,
        countryCode,
        status: status || "COLD",
        groupId: groupId || null,
        notes: notes || null,
        conversations: {
          create: {}
        }
      },
      include: {
        group: { select: { id: true, name: true, color: true } },
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
    status,
    groupId,
    dateRange = "all",
    startDate,
    endDate,
    communicationState = "all",
    sort = "newest_interaction",
    tag,
    assignedStaffId,
    page = 1,
    limit = 50
  } = params;

  // Build Prisma where clause
  const where: Record<string, unknown> = {};

  if (assignedStaffId !== undefined) {
    where.assignedStaffId = assignedStaffId;
  }

  // 1. Search across all customer fields
  if (search && search.trim()) {
    const q = search.trim();
    const cleanDigits = q.replace(/\D/g, "");
    const qUpper = q.toUpperCase();

    const orConditions: Record<string, unknown>[] = [
      { customName: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { whatsappName: { contains: q, mode: "insensitive" } },
      { phoneNumber: { contains: q, mode: "insensitive" } },
      { normalizedPhone: { contains: cleanDigits || q, mode: "insensitive" } },
      { about: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { countryCode: { contains: q, mode: "insensitive" } },
      {
        tags: {
          some: {
            tag: {
              name: { contains: q, mode: "insensitive" }
            }
          }
        }
      },
      {
        assignedStaff: {
          name: { contains: q, mode: "insensitive" }
        }
      },
      {
        assignedStaff: {
          email: { contains: q, mode: "insensitive" }
        }
      },
      {
        assignedStaff: {
          phone: { contains: q, mode: "insensitive" }
        }
      },
      {
        group: {
          name: { contains: q, mode: "insensitive" }
        }
      },
      {
        conversations: {
          some: {
            title: { contains: q, mode: "insensitive" }
          }
        }
      },
      {
        messages: {
          some: {
            body: { contains: q, mode: "insensitive" }
          }
        }
      }
    ];

    if (qUpper === "HOT" || qUpper === "WARM" || qUpper === "COLD") {
      orConditions.push({ status: qUpper });
    }

    if (qUpper === "ACTIVE" || qUpper === "BLOCKED" || qUpper === "OPTED_OUT") {
      orConditions.push({ state: qUpper });
    }

    where.OR = orConditions;
  }

  // 2. Date filters against lastInteractionAt or createdAt
  const now = new Date();
  if (dateRange === "today") {
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    where.lastInteractionAt = { gte: todayStart };
  } else if (dateRange === "yesterday") {
    const yesterdayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1
    );
    const yesterdayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
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

  // 3b. Status filter (HOT, WARM, COLD)
  if (status && status !== "all") {
    where.status = status;
  }

  // 3c. Group filter
  if (groupId && groupId !== "all") {
    if (groupId === "none" || groupId === "unassigned") {
      where.groupId = null;
    } else {
      where.groupId = groupId;
    }
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
        group: { select: { id: true, name: true, color: true } },
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
    companyName?: string | null;
    address?: string | null;
    profilePicUrl?: string | null;
    notes?: string | null;
    state?: CustomerState;
    status?: CustomerStatus;
    groupId?: string | null;
    tags?: string[];
  }
) {
  const updatePayload: Record<string, unknown> = {};
  if (data.customName !== undefined) updatePayload.customName = data.customName;
  if (data.companyName !== undefined)
    updatePayload.companyName = data.companyName;
  if (data.address !== undefined) updatePayload.address = data.address;
  if (data.profilePicUrl !== undefined)
    updatePayload.profilePicUrl = data.profilePicUrl;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.state !== undefined) updatePayload.state = data.state;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.groupId !== undefined) updatePayload.groupId = data.groupId;

  if (Object.keys(updatePayload).length > 0) {
    await prisma.customer.update({
      where: { id },
      data: updatePayload
    });
  }

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
      group: { select: { id: true, name: true, color: true } },
      tags: { include: { tag: true } },
      conversations: { take: 1, orderBy: { createdAt: "desc" } }
    }
  });

  realtimeBroadcaster.broadcast("CUSTOMER_UPDATED", finalCustomer);
  return finalCustomer;
}

export async function deleteCustomer(id: string) {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id } });

  // Delete all related records and customer in transaction
  await prisma.$transaction(async (tx) => {
    // 1. Delete MediaAttachments linked to this customer's messages
    const messageIds = (
      await tx.message.findMany({
        where: { customerId: id },
        select: { id: true }
      })
    ).map((m) => m.id);

    if (messageIds.length > 0) {
      await tx.mediaAttachment.deleteMany({
        where: { messageId: { in: messageIds } }
      });
    }

    // 2. Delete messages
    await tx.message.deleteMany({ where: { customerId: id } });

    // 3. Delete conversations
    await tx.conversation.deleteMany({ where: { customerId: id } });

    // 4. Delete bulk message recipient rows
    await tx.bulkMessageRecipient.deleteMany({ where: { customerId: id } });

    // 5. Delete customer tags
    await tx.customerTag.deleteMany({ where: { customerId: id } });

    // 6. Delete customer record
    await tx.customer.delete({ where: { id } });
  });

  realtimeBroadcaster.broadcast("CUSTOMERS_REFRESH", { deletedCustomerId: id });
  return customer;
}
