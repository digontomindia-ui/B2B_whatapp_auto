import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ensureDefaultRoles } from "@/server/roles/service";

export interface ImportStaffRow {
  email?: string;
  name?: string;
  phone?: string;
  password?: string;
  role?: string;
  [key: string]: unknown;
}

export interface ImportStaffOptions {
  updateExisting?: boolean;
  defaultRoleName?: string;
}

export interface ImportStaffResult {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    email?: string;
    error: string;
  }>;
}

function findField(row: Record<string, unknown>, aliases: string[]): string | undefined {
  for (const key of Object.keys(row)) {
    const cleanKey = key.trim().toLowerCase().replace(/[\s_-]+/g, "");
    for (const alias of aliases) {
      if (cleanKey === alias.toLowerCase().replace(/[\s_-]+/g, "")) {
        const val = row[key];
        if (typeof val === "string") return val.trim();
        if (typeof val === "number") return String(val).trim();
      }
    }
  }
  return undefined;
}

export async function importStaffFromCsv(
  rows: Array<Record<string, unknown>>,
  options: ImportStaffOptions = {}
): Promise<ImportStaffResult> {
  await ensureDefaultRoles();

  // Fetch all existing roles and build normalized lookup map
  const allRoles = await prisma.role.findMany();
  const roleMap = new Map<string, typeof allRoles[0]>();
  for (const r of allRoles) {
    roleMap.set(r.name.trim().toLowerCase(), r);
  }

  const availableRoleNames = allRoles.map((r) => r.name);

  const result: ImportStaffResult = {
    totalRows: rows.length,
    createdCount: 0,
    updatedCount: 0,
    errorCount: 0,
    errors: []
  };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const row = rows[i];

    const email = findField(row, ["email", "mail", "emailaddress", "staffemail"]);
    const name = findField(row, ["name", "fullname", "staffname", "displayname"]);
    const phone = findField(row, ["phone", "phonenumber", "mobile", "contact", "contactnumber"]);
    const password = findField(row, ["password", "pass", "pwd"]) || "Staff@12345";
    const roleInput = findField(row, ["role", "rolename", "designation", "accesslevel"]);

    if (!email) {
      result.errorCount++;
      result.errors.push({
        row: rowNum,
        error: "Missing required 'email' column"
      });
      continue;
    }

    const cleanEmail = email.toLowerCase();
    if (!cleanEmail.includes("@")) {
      result.errorCount++;
      result.errors.push({
        row: rowNum,
        email: cleanEmail,
        error: "Invalid email format"
      });
      continue;
    }

    const cleanName = name || cleanEmail.split("@")[0];

    // Check for role name and map it!
    const targetRoleName = roleInput || options.defaultRoleName;
    if (!targetRoleName) {
      result.errorCount++;
      result.errors.push({
        row: rowNum,
        email: cleanEmail,
        error: `Missing role name. Available roles: ${availableRoleNames.join(", ")}`
      });
      continue;
    }

    const matchedRole = roleMap.get(targetRoleName.toLowerCase());
    if (!matchedRole) {
      result.errorCount++;
      result.errors.push({
        row: rowNum,
        email: cleanEmail,
        error: `Unknown role "${targetRoleName}". Available roles: ${availableRoleNames.join(", ")}`
      });
      continue;
    }

    try {
      // Check if email belongs to admin
      const adminExists = await prisma.admin.findUnique({
        where: { email: cleanEmail }
      });
      if (adminExists) {
        result.errorCount++;
        result.errors.push({
          row: rowNum,
          email: cleanEmail,
          error: "Email is already registered as an Administrator"
        });
        continue;
      }

      // Check if staff exists
      const existingStaff = await prisma.staff.findUnique({
        where: { email: cleanEmail }
      });

      if (existingStaff) {
        if (options.updateExisting) {
          await prisma.staff.update({
            where: { id: existingStaff.id },
            data: {
              name: cleanName,
              phone: phone || existingStaff.phone,
              roleId: matchedRole.id
            }
          });
          result.updatedCount++;
        } else {
          result.errorCount++;
          result.errors.push({
            row: rowNum,
            email: cleanEmail,
            error: "Staff with this email already exists"
          });
        }
      } else {
        const passwordHash = await hashPassword(password);
        await prisma.staff.create({
          data: {
            email: cleanEmail,
            name: cleanName,
            phone: phone || null,
            passwordHash,
            roleId: matchedRole.id,
            isActive: true
          }
        });
        result.createdCount++;
      }
    } catch (err: unknown) {
      result.errorCount++;
      result.errors.push({
        row: rowNum,
        email: cleanEmail,
        error: err instanceof Error ? err.message : "Database error"
      });
    }
  }

  return result;
}
