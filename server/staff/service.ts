import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export interface CreateStaffInput {
  email: string;
  name: string;
  phone?: string | null;
  password: string;
  roleId: string;
}

export interface UpdateStaffInput {
  name?: string;
  phone?: string | null;
  roleId?: string;
  password?: string;
  isActive?: boolean;
}

export async function listStaff() {
  return prisma.staff.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      isActive: true,
      roleId: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: true
        }
      },
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function getStaffById(id: string) {
  return prisma.staff.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      isActive: true,
      roleId: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: true
        }
      },
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function createStaff(data: CreateStaffInput) {
  const cleanEmail = data.email.trim().toLowerCase();
  const cleanName = data.name.trim();

  if (!cleanEmail) throw new Error("Email is required");
  if (!cleanName) throw new Error("Name is required");
  if (!data.password || data.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  // Check if role exists
  const role = await prisma.role.findUnique({
    where: { id: data.roleId }
  });
  if (!role) {
    throw new Error("Selected role does not exist");
  }

  // Check if email already used by admin or staff
  const [existingAdmin, existingStaff] = await Promise.all([
    prisma.admin.findUnique({ where: { email: cleanEmail } }),
    prisma.staff.findUnique({ where: { email: cleanEmail } })
  ]);

  if (existingAdmin || existingStaff) {
    throw new Error(`Email "${cleanEmail}" is already registered`);
  }

  const passwordHash = await hashPassword(data.password);

  return prisma.staff.create({
    data: {
      email: cleanEmail,
      name: cleanName,
      phone: data.phone?.trim() || null,
      passwordHash,
      roleId: data.roleId,
      isActive: true
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      isActive: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: true
        }
      },
      createdAt: true
    }
  });
}

export async function updateStaff(id: string, data: UpdateStaffInput) {
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id } });

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) {
    const cleanName = data.name.trim();
    if (!cleanName) throw new Error("Name cannot be empty");
    updateData.name = cleanName;
  }

  if (data.phone !== undefined) {
    updateData.phone = data.phone?.trim() || null;
  }

  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  if (data.roleId !== undefined && data.roleId !== staff.roleId) {
    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new Error("Selected role does not exist");
    updateData.roleId = data.roleId;
  }

  if (data.password && data.password.trim().length >= 6) {
    updateData.passwordHash = await hashPassword(data.password.trim());
  }

  return prisma.staff.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      isActive: true,
      roleId: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: true
        }
      },
      updatedAt: true
    }
  });
}

export async function deleteStaff(id: string) {
  return prisma.staff.delete({
    where: { id }
  });
}
