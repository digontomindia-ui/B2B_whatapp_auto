import {
  TemplateCategory,
  TemplateStatus,
  ComponentType,
  Prisma
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { whatsappClient } from "@/clients/whatsapp";
import { WHATSAPP_CONFIG } from "@/lib/env";

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
              : Prisma.JsonNull,
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

export interface VariableMapping {
  type: "static" | "dynamic";
  field?: string;
  customField?: string;
  sample?: string;
  fallback?: string;
  staticValue?: string;
}

export interface CreateTemplateInput {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  header?: {
    type: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
    text?: string;
    example?: string[];
    variableMapping?: VariableMapping;
  };
  body: {
    text: string;
    examples?: string[];
    variableMappings?: Record<string, VariableMapping>;
  };
  footer?: {
    text?: string;
  };
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phoneNumber?: string;
    example?: string[];
  }>;
}

export async function createTemplate(
  input: CreateTemplateInput,
  wabaId?: string
) {
  const accountId = wabaId || WHATSAPP_CONFIG.BUSINESS_ID;
  if (!accountId) {
    throw new Error("Missing WhatsApp Business Account ID in configuration");
  }

  // Sanitize template name: Meta requires lowercase letters, numbers, and underscores only
  const sanitizedName = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  if (!sanitizedName) {
    throw new Error(
      "Valid template name is required (lowercase letters, numbers, and underscores only)"
    );
  }

  // Build Meta Graph API components payload
  const metaComponents: Array<Record<string, unknown>> = [];

  // 1. Header component
  if (input.header && input.header.type !== "NONE") {
    if (input.header.type === "TEXT" && input.header.text?.trim()) {
      const headerObj: Record<string, unknown> = {
        type: "HEADER",
        format: "TEXT",
        text: input.header.text.trim()
      };
      if (
        input.header.text.includes("{{1}}") &&
        input.header.example &&
        input.header.example.length > 0
      ) {
        headerObj.example = {
          header_text: input.header.example
        };
      }
      metaComponents.push(headerObj);
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(input.header.type)) {
      metaComponents.push({
        type: "HEADER",
        format: input.header.type
      });
    }
  }

  // 2. Body component
  const bodyText = input.body.text.trim();
  if (!bodyText) {
    throw new Error("Template body text is required");
  }

  const bodyObj: Record<string, unknown> = {
    type: "BODY",
    text: bodyText
  };

  // Find variables {{1}}, {{2}} in body text
  const bodyVarMatches = Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g));
  if (bodyVarMatches.length > 0) {
    const examples =
      input.body.examples && input.body.examples.length >= bodyVarMatches.length
        ? input.body.examples.slice(0, bodyVarMatches.length)
        : bodyVarMatches.map((m, idx) => `Sample ${m[1] || idx + 1}`);

    bodyObj.example = {
      body_text: [examples]
    };
  }
  metaComponents.push(bodyObj);

  // 3. Footer component
  if (input.footer?.text?.trim()) {
    metaComponents.push({
      type: "FOOTER",
      text: input.footer.text.trim()
    });
  }

  // 4. Buttons component
  if (input.buttons && input.buttons.length > 0) {
    const metaButtons = input.buttons.map((btn) => {
      if (btn.type === "URL") {
        const urlObj: Record<string, unknown> = {
          type: "URL",
          text: btn.text.trim(),
          url: btn.url?.trim() || ""
        };
        if (btn.url?.includes("{{1}}") && btn.example?.length) {
          urlObj.example = btn.example;
        }
        return urlObj;
      }
      if (btn.type === "PHONE_NUMBER") {
        return {
          type: "PHONE_NUMBER",
          text: btn.text.trim(),
          phone_number: btn.phoneNumber?.trim() || ""
        };
      }
      return {
        type: "QUICK_REPLY",
        text: btn.text.trim()
      };
    });

    metaComponents.push({
      type: "BUTTONS",
      buttons: metaButtons
    });
  }

  const metaPayload = {
    name: sanitizedName,
    category: input.category,
    language: input.language,
    components: metaComponents
  };

  // Call Meta WhatsApp Graph API
  const metaRes = await whatsappClient.createTemplate(metaPayload, accountId);
  if (!metaRes.success || !metaRes.templateId) {
    throw new Error(metaRes.error || "Failed to create template on Meta");
  }

  const status = mapMetaStatus(metaRes.status || "PENDING");
  const category = mapMetaCategory(input.category);

  // Save to database in transaction
  const createdTemplate = await prisma.$transaction(async (tx) => {
    const tmpl = await tx.whatsappTemplate.upsert({
      where: {
        wabaId_name_language: {
          wabaId: accountId,
          name: sanitizedName,
          language: input.language
        }
      },
      update: {
        metaTemplateId: metaRes.templateId,
        status,
        category,
        rawResponse: metaRes.raw as unknown as Prisma.InputJsonValue
      },
      create: {
        metaTemplateId: metaRes.templateId,
        wabaId: accountId,
        name: sanitizedName,
        language: input.language,
        category,
        status,
        rawResponse: metaRes.raw as unknown as Prisma.InputJsonValue
      }
    });

    // Delete existing components if any
    await tx.templateComponent.deleteMany({
      where: { templateId: tmpl.id }
    });

    // Insert components and buttons
    for (let pos = 0; pos < metaComponents.length; pos++) {
      const comp = metaComponents[pos];
      const compType = mapMetaComponentType(comp.type as string);
      // Attach variable mappings for BODY or HEADER
      let examplesData: unknown = comp.example || null;
      let rawJsonData: Record<string, unknown> = {
        ...(comp as Record<string, unknown>)
      };

      if (compType === ComponentType.BODY && input.body.variableMappings) {
        examplesData = {
          ...(comp.example ? (comp.example as Record<string, unknown>) : {}),
          variableMappings: input.body.variableMappings
        };
        rawJsonData = {
          ...rawJsonData,
          variableMappings: input.body.variableMappings
        };
      } else if (
        compType === ComponentType.HEADER &&
        input.header?.variableMapping
      ) {
        examplesData = {
          ...(comp.example ? (comp.example as Record<string, unknown>) : {}),
          variableMapping: input.header.variableMapping
        };
        rawJsonData = {
          ...rawJsonData,
          variableMapping: input.header.variableMapping
        };
      }

      const createdComp = await tx.templateComponent.create({
        data: {
          templateId: tmpl.id,
          type: compType,
          format: (comp.format as string) || null,
          text: (comp.text as string) || null,
          examples: examplesData
            ? (examplesData as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          rawJson: rawJsonData as unknown as Prisma.InputJsonValue,
          position: pos
        }
      });

      if (comp.buttons && Array.isArray(comp.buttons)) {
        for (let bPos = 0; bPos < comp.buttons.length; bPos++) {
          const btn = comp.buttons[bPos] as Record<string, string>;
          await tx.templateButton.create({
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

    return tx.whatsappTemplate.findUnique({
      where: { id: tmpl.id },
      include: {
        components: {
          orderBy: { position: "asc" },
          include: {
            buttons: { orderBy: { position: "asc" } }
          }
        }
      }
    });
  });

  return createdTemplate;
}
