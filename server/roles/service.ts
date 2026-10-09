import {
  PERMISSIONS_PRESETS,
  ALL_PERMISSIONS,
  normalizePermissions,
  PERMISSIONS
} from "@/lib/permissions";
import prisma from "@/lib/prisma";

export async function ensureDefaultRoles() {
  const count = await prisma.role.count();
  if (count > 0) return;

  for (const preset of PERMISSIONS_PRESETS) {
    if (preset.perms === "none") continue;

    const perms =
      preset.perms === "all"
        ? ALL_PERMISSIONS
        : (preset.perms as PERMISSIONS[]);

    await prisma.role.upsert({
      where: { name: preset.label },
      create: {
        name: preset.label,
        description: preset.description,
        permissions: perms,
        isSystem: true
      },
      update: {}
    });
  }
}

export async function listRoles() {
  await ensureDefaultRoles();

  return prisma.role.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { staff: true }
      }
    }
  });
}

export async function getRoleById(id: string) {
  return prisma.role.findUniqueOrThrow({
    where: { id },
    include: {
      _count: {
        select: { staff: true }
      }
    }
  });
}

export async function createRole(data: {
  name: string;
  description?: string | null;
  permissions: number[];
}) {
  const cleanName = data.name.trim();
  if (!cleanName) {
    throw new Error("Role name is required");
  }

  const existing = await prisma.role.findUnique({
    where: { name: cleanName }
  });

  if (existing) {
    throw new Error(`Role "${cleanName}" already exists`);
  }

  const validPerms = normalizePermissions(data.permissions);

  return prisma.role.create({
    data: {
      name: cleanName,
      description: data.description?.trim() || null,
      permissions: validPerms,
      isSystem: false
    }
  });
}

export async function updateRole(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    permissions?: number[];
  }
) {
  const role = await prisma.role.findUniqueOrThrow({ where: { id } });

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) {
    const cleanName = data.name.trim();
    if (!cleanName) throw new Error("Role name cannot be empty");

    if (cleanName !== role.name) {
      const existing = await prisma.role.findUnique({
        where: { name: cleanName }
      });
      if (existing) {
        throw new Error(`Role name "${cleanName}" is already taken`);
      }
      updateData.name = cleanName;
    }
  }

  if (data.description !== undefined) {
    updateData.description = data.description?.trim() || null;
  }

  if (data.permissions !== undefined) {
    updateData.permissions = normalizePermissions(data.permissions);
  }

  return prisma.role.update({
    where: { id },
    data: updateData
  });
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { id },
    include: {
      _count: { select: { staff: true } }
    }
  });

  if (role.isSystem) {
    throw new Error("System default roles cannot be deleted");
  }

  if (role._count.staff > 0) {
    throw new Error(
      `Cannot delete role "${role.name}" because it is currently assigned to ${role._count.staff} staff member(s)`
    );
  }

  return prisma.role.delete({
    where: { id }
  });
}
