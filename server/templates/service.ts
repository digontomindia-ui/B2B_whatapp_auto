import prisma from "@/lib/prisma";
import { whatsappClient } from "@/clients/whatsapp";
import { WHATSAPP_CONFIG } from "@/lib/env";
import {
  TemplateCategory,
  TemplateStatus,
  ComponentType,
  Prisma
} from "@prisma/client";

function mapMetaStatus(status: string): TemplateStatus {
  const s = status.toUpperCase();
  if (s in TemplateStatus) {
    return s as TemplateStatus;
  }
  return TemplateStatus.PENDING;
}

function mapMetaCategory(category: string): TemplateCategory {
  const c = category.toUpperCase();
  if (c in TemplateCategory) {
    return c as TemplateCategory;
  }
  return TemplateCategory.MARKETING;
}

function mapMetaComponentType(type: string): ComponentType {
  const t = type.toUpperCase();
  if (t in ComponentType) {
    return t as ComponentType;
  }
  return ComponentType.BODY;
}

export async function syncTemplatesFromMeta(wabaId?: string) {
  const accountId = wabaId || WHATSAPP_CONFIG.BUSINESS_ID;
  if (!accountId) {
    throw new Error("Missing WhatsApp Business Account ID in configuration");
  }

  const { templates, error } = await whatsappClient.fetchTemplates(accountId);
  if (error) {
    throw new Error(`Meta Template Sync Error: ${error}`);
  }

  const syncedResults = [];

  for (const item of templates) {
    const status = mapMetaStatus(item.status);
    const category = mapMetaCategory(item.category);

    const template = await prisma.whatsappTemplate.upsert({
      where: {
        wabaId_name_language: {
          wabaId: accountId,
          name: item.name,
          language: item.language
        }
      },
      update: {
        metaTemplateId: item.id,
        status,
        category,
        quality: item.quality_score?.score || null,
        rejectedReason: item.rejected_reason || null,
        rawResponse: item as unknown as Prisma.InputJsonValue
      },
      create: {
        metaTemplateId: item.id,
        wabaId: accountId,
        name: item.name,
        language: item.language,
        category,
        status,
        quality: item.quality_score?.score || null,
        rejectedReason: item.rejected_reason || null,
        rawResponse: item as unknown as Prisma.InputJsonValue
      }
    });

    // Delete existing components and rebuild from Meta definition
    await prisma.templateComponent.deleteMany({
      where: { templateId: template.id }
    });

    if (item.components && Array.isArray(item.components)) {
      for (let pos = 0; pos < item.components.length; pos++) {
        const comp = item.components[pos];
        const compType = mapMetaComponentType(comp.type);

        const createdComp = await prisma.templateComponent.create({
          data: {
            templateId: template.id,
            type: compType,
            format: comp.format || null,
            text: comp.text || null,
            examples: comp.example
              ? (comp.example as unknown as Prisma.InputJsonValue)
              : null,
            rawJson: comp as unknown as Prisma.InputJsonValue,
            position: pos
          }
        });

        // Insert buttons if component is BUTTONS
        if (comp.buttons && Array.isArray(comp.buttons)) {
          for (let bPos = 0; bPos < comp.buttons.length; bPos++) {
            const btn = comp.buttons[bPos];
            await prisma.templateButton.create({
              data: {
                componentId: createdComp.id,
                type: btn.type || "QUICK_REPLY",
                text: btn.text || "",
                url: btn.url || null,
                phoneNumber: btn.phone_number || null,
                position: bPos,
                rawJson: btn as unknown as Prisma.InputJsonValue
              }
            });
          }
        }
      }
    }

    syncedResults.push(template);
  }

  return syncedResults;
}

export async function listTemplates(
  params: {
    status?: string;
    category?: string;
    search?: string;
  } = {}
) {
  const where: Record<string, unknown> = {};

  if (params.status && params.status !== "all") {
    where.status = mapMetaStatus(params.status);
  }

  if (params.category && params.category !== "all") {
    where.category = mapMetaCategory(params.category);
  }

  if (params.search && params.search.trim()) {
    where.name = { contains: params.search.trim(), mode: "insensitive" };
  }

  const templates = await prisma.whatsappTemplate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      components: {
        orderBy: { position: "asc" },
        include: {
          buttons: { orderBy: { position: "asc" } }
        }
      }
    }
  });

  return templates;
}

export async function getTemplateById(id: string) {
  return prisma.whatsappTemplate.findUniqueOrThrow({
    where: { id },
    include: {
      components: {
        orderBy: { position: "asc" },
        include: {
          buttons: { orderBy: { position: "asc" } }
        }
      }
    }
  });
}
