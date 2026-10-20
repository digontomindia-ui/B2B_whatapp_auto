import type { CustomerFilterParams } from "./service";
import { normalizePhoneNumber, extractCountryCode } from "@/utils/phone";
import { CustomerState, CustomerStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { realtimeBroadcaster } from "@/server/realtime/broadcaster";
import Papa from "papaparse";

export interface ImportOptions {
  updateExisting: boolean;
  defaultTag?: string;
}

export interface ImportResult {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ row: number; phone?: string; reason: string }>;
}

export interface ExportOptions {
  customerIds?: string[];
  filterParams?: CustomerFilterParams;
  columns?: string[]; // list of column keys to include
}

// Available exportable columns dictionary
export const EXPORTABLE_COLUMNS: Record<string, string> = {
  name: "name",
  ph_no: "ph_no",
  company_name: "company name",
  address: "address",
  tag: "tag",
  group: "group",
  note: "note",
  assign_to: "assign to",
  status: "status",
  state: "state",
  unreadCount: "unreadCount",
  lastInteractionAt: "lastInteractionAt",
  createdAt: "createdAt"
};

// Map row column headers flexibly
function getFieldValue(
  row: Record<string, string>,
  aliases: string[]
): string | undefined {
  const normalizedKeys = Object.keys(row).map((k) => ({
    original: k,
    cleaned: k
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "")
  }));

  for (const alias of aliases) {
    const target = alias.toLowerCase().replace(/[\s_-]+/g, "");
    const match = normalizedKeys.find((k) => k.cleaned === target);
    if (
      match &&
      row[match.original] !== undefined &&
      row[match.original] !== null
    ) {
      const val = String(row[match.original]).trim();
      if (val.length > 0) return val;
    }
  }
  return undefined;
}

export async function importContactsFromCsv(
  rows: Array<Record<string, string>>,
  options: ImportOptions = { updateExisting: true }
): Promise<ImportResult> {
  const result: ImportResult = {
    totalRows: rows.length,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: []
  };

  const tagCache = new Map<string, string>(); // name -> tagId
  const staffCache = new Map<string, string | null>(); // email -> staffId | null
  const groupCache = new Map<string, string>(); // lowercase name -> groupId

  // 1. Strict duplicate validation: Validate that no duplicate phone numbers exist within this import batch
  const phoneToRowsMap = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const rawP = getFieldValue(rows[i], [
      "ph_no",
      "phno",
      "ph_number",
      "phone",
      "phonenumber",
      "phone_number",
      "mobile",
      "mobilenumber",
      "mobile_number",
      "contact",
      "contactnumber",
      "contact_number",
      "whatsapp",
      "number"
    ]);
    if (rawP) {
      const norm = normalizePhoneNumber(rawP) || rawP.trim();
      const existingRows = phoneToRowsMap.get(norm) || [];
      existingRows.push(i + 1);
      phoneToRowsMap.set(norm, existingRows);
    }
  }

  const dupMessages: string[] = [];
  for (const [phone, rowNums] of phoneToRowsMap.entries()) {
    if (rowNums.length > 1) {
      dupMessages.push(`${phone} (rows ${rowNums.join(", ")})`);
    }
  }

  if (dupMessages.length > 0) {
    throw new Error(
      `Duplicate phone numbers detected in import batch (${dupMessages.length} duplicate numbers): ${dupMessages.slice(0, 5).join("; ")}${dupMessages.length > 5 ? ` and ${dupMessages.length - 5} more` : ""}. Phone numbers must be unique.`
    );
  }

  // Helper to resolve tag IDs
  async function resolveTagIds(tagNames: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const name of tagNames) {
      const cleanName = name.trim();
      if (!cleanName) continue;

      let tagId = tagCache.get(cleanName.toLowerCase());
      if (!tagId) {
        const tag = await prisma.tag.upsert({
          where: { name: cleanName },
          update: {},
          create: { name: cleanName }
        });
        tagId = tag.id;
        tagCache.set(cleanName.toLowerCase(), tagId);
      }
      ids.push(tagId);
    }
    return ids;
  }

  // Helper to resolve group ID (case-insensitive matching or creating)
  async function resolveGroupId(groupName: string): Promise<string | null> {
    const cleanName = groupName.trim();
    if (!cleanName) return null;
    const key = cleanName.toLowerCase();
    if (groupCache.has(key)) {
      return groupCache.get(key) || null;
    }

    let group = await prisma.group.findFirst({
      where: { name: { equals: cleanName, mode: "insensitive" } }
    });

    if (!group) {
      try {
        group = await prisma.group.create({
          data: { name: cleanName }
        });
      } catch {
        group = await prisma.group.findFirst({
          where: { name: { equals: cleanName, mode: "insensitive" } }
        });
      }
    }

    if (group) {
      groupCache.set(key, group.id);
      return group.id;
    }
    return null;
  }

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNumber = idx + 1;

    // 1. Extract phone number (ph_no)
    const rawPhone = getFieldValue(row, [
      "ph_no",
      "phno",
      "ph_number",
      "phone",
      "phonenumber",
      "phone_number",
      "mobile",
      "mobilenumber",
      "mobile_number",
      "contact",
      "contactnumber",
      "contact_number",
      "whatsapp",
      "number"
    ]);

    if (!rawPhone) {
      result.errorCount++;
      result.errors.push({
        row: rowNumber,
        reason: "Missing phone number in row"
      });
      continue;
    }

    const normalizedPhone = normalizePhoneNumber(rawPhone);
    if (!normalizedPhone) {
      result.errorCount++;
      result.errors.push({
        row: rowNumber,
        phone: rawPhone,
        reason: `Invalid phone format: "${rawPhone}"`
      });
      continue;
    }

    // 2. Extract customer name
    const customName = getFieldValue(row, [
      "name",
      "customer name",
      "customer_name",
      "customname",
      "custom_name",
      "fullname",
      "full_name",
      "contactname",
      "contact_name",
      "first_name",
      "firstname"
    ]);

    // 3. Extract company name
    const companyName = getFieldValue(row, [
      "company name",
      "company_name",
      "company",
      "companyname",
      "organization",
      "business",
      "firm"
    ]);

    // 4. Extract physical address
    const address = getFieldValue(row, [
      "address",
      "physical address",
      "physical_address",
      "location",
      "street",
      "city"
    ]);

    const whatsappName = getFieldValue(row, [
      "whatsappname",
      "whatsapp_name",
      "waname",
      "wa_name",
      "profile_name",
      "profilename"
    ]);

    // 5. Extract custom note
    const notes = getFieldValue(row, [
      "note",
      "notes",
      "custom note",
      "custom_note",
      "remarks",
      "remark",
      "comment",
      "comments",
      "description"
    ]);

    // 6. Extract staff email (assign to)
    const rawStaffEmail = getFieldValue(row, [
      "assign to",
      "assign_to",
      "assigned to",
      "assigned_to",
      "staff email",
      "staff_email",
      "staffemail",
      "staff_mail",
      "staff",
      "assigned_staff",
      "agent email",
      "agent_email",
      "agent",
      "owner_email"
    ]);

    let assignedStaffId: string | null = null;
    if (rawStaffEmail) {
      const cleanEmail = rawStaffEmail.trim().toLowerCase();
      if (staffCache.has(cleanEmail)) {
        assignedStaffId = staffCache.get(cleanEmail) || null;
      } else {
        const staff = await prisma.staff.findUnique({
          where: { email: cleanEmail }
        });
        assignedStaffId = staff ? staff.id : null;
        staffCache.set(cleanEmail, assignedStaffId);
      }
    }

    const stateRaw = getFieldValue(row, [
      "state",
      "communication_state",
      "communicationstate",
      "customer_state"
    ]);
    let state: CustomerState = CustomerState.ACTIVE;
    if (stateRaw) {
      const upper = stateRaw.toUpperCase();
      if (upper === "BLOCKED") state = CustomerState.BLOCKED;
      else if (
        upper === "OPTED_OUT" ||
        upper === "OPTEDOUT" ||
        upper === "OPT_OUT"
      ) {
        state = CustomerState.OPTED_OUT;
      }
    }

    const statusRaw = getFieldValue(row, [
      "status",
      "lead_status",
      "leadstatus",
      "customer_status"
    ]);
    let status: CustomerStatus = CustomerStatus.COLD;
    if (statusRaw) {
      const upper = statusRaw.toUpperCase();
      if (upper === "HOT") status = CustomerStatus.HOT;
      else if (upper === "WARM") status = CustomerStatus.WARM;
      else if (upper === "COLD") status = CustomerStatus.COLD;
    }

    // 3. Extract group name (case-insensitive matching or creating)
    const rawGroup = getFieldValue(row, [
      "group",
      "group_name",
      "groupname",
      "school",
      "school_name",
      "schoolname",
      "customer_group",
      "customergroup"
    ]);

    let groupId: string | null = null;
    if (rawGroup) {
      groupId = await resolveGroupId(rawGroup);
    }

    // 4. Extract and parse tags
    const rawTags = getFieldValue(row, ["tags", "tag", "labels", "label"]);
    const tagList: string[] = [];
    if (rawTags) {
      // Split by comma or semicolon
      tagList.push(
        ...rawTags
          .split(/[,;]+/)
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }
    if (options.defaultTag && options.defaultTag.trim()) {
      tagList.push(options.defaultTag.trim());
    }

    const uniqueTagNames = Array.from(new Set(tagList));
    const tagIds = await resolveTagIds(uniqueTagNames);

    try {
      // 5. Find existing customer by normalized phone
      const existing = await prisma.customer.findUnique({
        where: { normalizedPhone },
        include: {
          tags: true,
          conversations: { take: 1, orderBy: { createdAt: "desc" } }
        }
      });

      if (existing) {
        if (!options.updateExisting) {
          result.skippedCount++;
          continue;
        }

        // Update existing customer
        const dataToUpdate: Record<string, unknown> = {};
        if (customName && customName !== existing.customName) {
          dataToUpdate.customName = customName;
        }
        if (companyName && companyName !== existing.companyName) {
          dataToUpdate.companyName = companyName;
        }
        if (address && address !== existing.address) {
          dataToUpdate.address = address;
        }
        if (notes && notes !== existing.notes) {
          // If notes exist, append or update
          dataToUpdate.notes = existing.notes
            ? `${existing.notes}\n[Import]: ${notes}`
            : notes;
        }
        if (stateRaw && state !== existing.state) {
          dataToUpdate.state = state;
        }
        if (statusRaw && status !== existing.status) {
          dataToUpdate.status = status;
        }
        if (assignedStaffId !== null) {
          dataToUpdate.assignedStaffId = assignedStaffId;
        }
        if (groupId !== null && groupId !== existing.groupId) {
          dataToUpdate.groupId = groupId;
        }

        // Find which tag IDs are not yet associated
        const existingTagIds = new Set(existing.tags.map((t) => t.tagId));
        const newTagIds = tagIds.filter((id) => !existingTagIds.has(id));

        if (Object.keys(dataToUpdate).length > 0 || newTagIds.length > 0) {
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              ...dataToUpdate,
              ...(newTagIds.length > 0
                ? {
                    tags: {
                      createMany: {
                        data: newTagIds.map((tagId) => ({ tagId }))
                      }
                    }
                  }
                : {})
            }
          });
        }

        result.updatedCount++;
      } else {
        // Create brand new customer
        const countryCode = extractCountryCode(normalizedPhone);
        const createdCustomer = await prisma.customer.create({
          data: {
            phoneNumber: rawPhone,
            normalizedPhone,
            customName: customName || null,
            whatsappName: whatsappName || null,
            companyName: companyName || null,
            address: address || null,
            countryCode,
            notes: notes || null,
            state,
            status,
            groupId: groupId || null,
            assignedStaffId: assignedStaffId || null,
            ...(tagIds.length > 0
              ? {
                  tags: {
                    createMany: {
                      data: tagIds.map((tagId) => ({ tagId }))
                    }
                  }
                }
              : {}),
            conversations: {
              create: {}
            }
          }
        });

        result.createdCount++;
        realtimeBroadcaster.broadcast("CUSTOMER_CREATED", createdCustomer);
      }
    } catch (err: unknown) {
      result.errorCount++;
      const msg = err instanceof Error ? err.message : "Database error";
      result.errors.push({
        row: rowNumber,
        phone: rawPhone,
        reason: msg
      });
    }
  }

  // Trigger realtime refresh for customers list
  realtimeBroadcaster.broadcast("CUSTOMERS_REFRESH", {
    created: result.createdCount,
    updated: result.updatedCount
  });

  return result;
}

export async function exportContactsToCsv(
  options: ExportOptions = {}
): Promise<{
  csv: string;
  totalCount: number;
  filename: string;
}> {
  const { customerIds, filterParams, columns } = options;

  // Selected columns to include (default: all)
  const activeCols =
    columns && columns.length > 0 ? columns : Object.keys(EXPORTABLE_COLUMNS);

  const where: Prisma.CustomerWhereInput = {};

  if (customerIds && customerIds.length > 0) {
    where.id = { in: customerIds };
  } else if (filterParams) {
    // Apply filters matching Customer filter rules
    if (filterParams.search) {
      const q = filterParams.search.trim();
      const cleanDigits = q.replace(/\D/g, "");
      const qUpper = q.toUpperCase();
      const orConditions: Prisma.CustomerWhereInput[] = [
        {
          normalizedPhone: { contains: cleanDigits || q, mode: "insensitive" }
        },
        { phoneNumber: { contains: q, mode: "insensitive" } },
        { customName: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
        { whatsappName: { contains: q, mode: "insensitive" } },
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
        orConditions.push({ status: qUpper as CustomerStatus });
      }

      if (
        qUpper === "ACTIVE" ||
        qUpper === "BLOCKED" ||
        qUpper === "OPTED_OUT"
      ) {
        orConditions.push({ state: qUpper as CustomerState });
      }

      where.OR = orConditions;
    }

    if (filterParams.status && filterParams.status !== "all") {
      where.status = filterParams.status;
    }

    if (
      filterParams.communicationState &&
      filterParams.communicationState !== "all"
    ) {
      switch (filterParams.communicationState) {
        case "unread":
          where.unreadCount = { gt: 0 };
          break;
        case "read":
          where.unreadCount = 0;
          break;
        case "blocked":
          where.state = CustomerState.BLOCKED;
          break;
        case "opted_out":
          where.state = CustomerState.OPTED_OUT;
          break;
        case "active":
          where.state = CustomerState.ACTIVE;
          break;
        case "has_conversation":
          where.conversations = { some: {} };
          break;
      }
    }

    if (filterParams.tag) {
      where.tags = {
        some: {
          tag: { name: { equals: filterParams.tag, mode: "insensitive" } }
        }
      };
    }

    if (filterParams.groupId && filterParams.groupId !== "all") {
      if (
        filterParams.groupId === "none" ||
        filterParams.groupId === "unassigned"
      ) {
        where.groupId = null;
      } else {
        where.groupId = filterParams.groupId;
      }
    }

    if (filterParams.dateRange && filterParams.dateRange !== "all") {
      const now = new Date();
      let fromDate: Date | null = null;
      let toDate: Date | null = null;

      if (filterParams.dateRange === "today") {
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (filterParams.dateRange === "yesterday") {
        fromDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1
        );
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (filterParams.dateRange === "last7days") {
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (filterParams.dateRange === "last30days") {
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      if (fromDate || toDate) {
        where.lastInteractionAt = {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lt: toDate } : {})
        };
      }
    }
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      group: { select: { name: true } },
      tags: { include: { tag: true } },
      assignedStaff: { select: { name: true, email: true } }
    }
  });

  // Map to CSV rows based on selected columns
  const exportRows = customers.map((c) => {
    const rowObj: Record<string, string | number> = {};

    for (const colKey of activeCols) {
      const headerTitle = EXPORTABLE_COLUMNS[colKey] || colKey;

      switch (colKey) {
        case "name":
        case "customName":
          rowObj[headerTitle] = c.customName || c.whatsappName || "";
          break;
        case "ph_no":
        case "phone":
          rowObj[headerTitle] = c.phoneNumber || c.normalizedPhone;
          break;
        case "normalizedPhone":
          rowObj[headerTitle] = c.normalizedPhone;
          break;
        case "whatsappName":
          rowObj[headerTitle] = c.whatsappName || "";
          break;
        case "company_name":
        case "companyName":
          rowObj[headerTitle] = c.companyName || "";
          break;
        case "address":
          rowObj[headerTitle] = c.address || "";
          break;
        case "group":
          rowObj[headerTitle] = c.group?.name || "";
          break;
        case "tag":
        case "tags":
          rowObj[headerTitle] = c.tags.map((t) => t.tag.name).join(", ");
          break;
        case "state":
          rowObj[headerTitle] = c.state;
          break;
        case "status":
          rowObj[headerTitle] = c.status;
          break;
        case "note":
        case "notes":
          rowObj[headerTitle] = c.notes || "";
          break;
        case "assign_to":
        case "staff_email":
          rowObj[headerTitle] = c.assignedStaff?.email || "";
          break;
        case "staff_name":
          rowObj[headerTitle] = c.assignedStaff?.name || "";
          break;
        case "unreadCount":
          rowObj[headerTitle] = c.unreadCount;
          break;
        case "lastInteractionAt":
          rowObj[headerTitle] = c.lastInteractionAt
            ? new Date(c.lastInteractionAt)
                .toISOString()
                .replace("T", " ")
                .substring(0, 19)
            : "";
          break;
        case "createdAt":
          rowObj[headerTitle] = new Date(c.createdAt)
            .toISOString()
            .replace("T", " ")
            .substring(0, 19);
          break;
      }
    }

    return rowObj;
  });

  const csv = Papa.unparse(exportRows, {
    header: true,
    quotes: true
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `whatsapp_contacts_${dateStr}.csv`;

  return {
    csv,
    totalCount: customers.length,
    filename
  };
}
