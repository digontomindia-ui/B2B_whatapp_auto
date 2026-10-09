import prisma from "@/lib/prisma";

export interface DistributionStaffInfo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  roleName: string;
  assignedCount: number;
}

export interface DistributionStats {
  totalCustomers: number;
  unassignedCount: number;
  assignedCount: number;
  staffList: DistributionStaffInfo[];
}

export async function getDistributionStats(): Promise<DistributionStats> {
  const [totalCustomers, unassignedCount, staffList] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { assignedStaffId: null } }),
    prisma.staff.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        role: { select: { name: true } },
        _count: { select: { assignedCustomers: true } }
      }
    })
  ]);

  return {
    totalCustomers,
    unassignedCount,
    assignedCount: totalCustomers - unassignedCount,
    staffList: staffList.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      isActive: s.isActive,
      roleName: s.role.name,
      assignedCount: s._count.assignedCustomers
    }))
  };
}

export async function autoDistributeCustomers({
  staffIds,
  onlyUnassigned = true
}: {
  staffIds?: string[];
  onlyUnassigned?: boolean;
}) {
  const staffWhere: Record<string, unknown> = { isActive: true };
  if (staffIds && staffIds.length > 0) {
    staffWhere.id = { in: staffIds };
  }

  const activeStaff = await prisma.staff.findMany({
    where: staffWhere,
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { assignedCustomers: true } }
    }
  });

  if (activeStaff.length === 0) {
    throw new Error("No active staff members available for distribution");
  }

  const customerWhere: Record<string, unknown> = {};
  if (onlyUnassigned) {
    customerWhere.assignedStaffId = null;
  }

  const customers = await prisma.customer.findMany({
    where: customerWhere,
    select: { id: true }
  });

  if (customers.length === 0) {
    return {
      totalDistributed: 0,
      breakdown: []
    };
  }

  // Least-loaded balancing algorithm
  const loadMap = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      currentCount: number;
      newlyAssigned: number;
      assignedIds: string[];
    }
  >();

  for (const s of activeStaff) {
    loadMap.set(s.id, {
      id: s.id,
      name: s.name,
      email: s.email,
      currentCount: onlyUnassigned ? s._count.assignedCustomers : 0,
      newlyAssigned: 0,
      assignedIds: []
    });
  }

  const staffArray = Array.from(loadMap.values());

  for (const customer of customers) {
    staffArray.sort((a, b) => a.currentCount - b.currentCount);
    const chosen = staffArray[0];
    chosen.currentCount++;
    chosen.newlyAssigned++;
    chosen.assignedIds.push(customer.id);
  }

  // Batch update assigned staff
  for (const staff of staffArray) {
    if (staff.assignedIds.length > 0) {
      await prisma.customer.updateMany({
        where: { id: { in: staff.assignedIds } },
        data: { assignedStaffId: staff.id }
      });
    }
  }

  return {
    totalDistributed: customers.length,
    breakdown: staffArray.map((s) => ({
      staffId: s.id,
      name: s.name,
      email: s.email,
      assignedNow: s.newlyAssigned,
      totalAssigned: s.currentCount
    }))
  };
}

export async function manualQuotaDistributeCustomers({
  allocations,
  onlyUnassigned = true
}: {
  allocations: Array<{ staffId: string; count: number }>;
  onlyUnassigned?: boolean;
}) {
  const breakdown: Array<{
    staffId: string;
    name: string;
    email: string;
    assignedNow: number;
  }> = [];
  let totalDistributed = 0;

  for (const alloc of allocations) {
    if (alloc.count <= 0) continue;

    const staff = await prisma.staff.findUnique({
      where: { id: alloc.staffId },
      select: { id: true, name: true, email: true }
    });
    if (!staff) continue;

    const where: Record<string, unknown> = {};
    if (onlyUnassigned) {
      where.assignedStaffId = null;
    }

    const availableCustomers = await prisma.customer.findMany({
      where,
      take: alloc.count,
      select: { id: true }
    });

    if (availableCustomers.length > 0) {
      const ids = availableCustomers.map((c) => c.id);
      await prisma.customer.updateMany({
        where: { id: { in: ids } },
        data: { assignedStaffId: staff.id }
      });

      totalDistributed += ids.length;
      breakdown.push({
        staffId: staff.id,
        name: staff.name,
        email: staff.email,
        assignedNow: ids.length
      });
    }
  }

  return {
    totalDistributed,
    breakdown
  };
}

export async function assignCustomersDirectly({
  customerIds,
  staffId
}: {
  customerIds: string[];
  staffId: string | null;
}) {
  if (customerIds.length === 0) {
    return { count: 0 };
  }

  const result = await prisma.customer.updateMany({
    where: { id: { in: customerIds } },
    data: { assignedStaffId: staffId }
  });

  return { count: result.count };
}
