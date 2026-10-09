"use client";

import type { DashboardCustomer, DashboardTemplate } from "./types";
import { Layers, Loader2, X, Sparkles, Pin } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { formatDisplayPhone } from "@/utils/phone";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";

export interface VariableConfigItem {
  type: "static" | "dynamic";
  field: string;
  staticValue: string;
  fallback: string;
}

const CRM_FIELDS = [
  { key: "customer.name", label: "Contact Name (Full / Display)" },
  { key: "customer.customName", label: "Custom CRM Name" },
  { key: "customer.phoneNumber", label: "Phone Number" },
  { key: "customer.whatsappName", label: "WhatsApp Profile Name" },
  { key: "customer.notes", label: "Staff Notes" },
  { key: "customer.about", label: "WhatsApp About" }
];

interface SendTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: DashboardCustomer | null;
  templates: DashboardTemplate[];
  initialTemplateId?: string;
  onSent: () => void;
}

export function SendTemplateDialog({
  isOpen,
  onClose,
  customer,
  templates,
  initialTemplateId,
  onSent
}: SendTemplateDialogProps) {
  const { hasPermission, isOwner } = useAuth();
  const canSendUtility =
    isOwner || hasPermission(PERMISSIONS.MESSAGE_SEND_UTILITY);
  const canSendMarketing =
    isOwner || hasPermission(PERMISSIONS.MESSAGE_SEND_MARKETING);

  const approvedTemplates = useMemo(() => {
    return templates.filter((t) => {
      const isApprovedOrPending =
        t.status === "APPROVED" || t.status === "PENDING";
      if (!isApprovedOrPending) return false;

      if (t.category === "MARKETING") return canSendMarketing;
      if (t.category === "UTILITY") return canSendUtility;
      return canSendUtility || canSendMarketing;
    });
  }, [templates, canSendMarketing, canSendUtility]);

  const defaultTemplateId = useMemo(() => {
    if (initialTemplateId) return initialTemplateId;
    return approvedTemplates.length > 0 ? approvedTemplates[0].id : "";
  }, [initialTemplateId, approvedTemplates]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customConfigs, setCustomConfigs] = useState<
    Record<string, VariableConfigItem>
  >({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);

  const activeTemplateId = selectedTemplateId || defaultTemplateId;

  const selectedTemplate = useMemo(() => {
    return approvedTemplates.find((t) => t.id === activeTemplateId);
  }, [approvedTemplates, activeTemplateId]);

  const bodyComponent = useMemo(() => {
    return selectedTemplate?.components.find(
      (c) => String(c.type).toUpperCase() === "BODY"
    );
  }, [selectedTemplate]);

  const headerComponent = useMemo(() => {
    return selectedTemplate?.components.find(
      (c) =>
        String(c.type).toUpperCase() === "HEADER" &&
        (!c.format || c.format.toUpperCase() === "TEXT")
    );
  }, [selectedTemplate]);

  const bodyText = bodyComponent?.text || "";
  const headerText = headerComponent?.text || "";

  // Extract variables from body
  const bodyVarKeys = useMemo(() => {
    const matches = Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g));
    const keys = Array.from(new Set(matches.map((m) => m[1])));
    return keys.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [bodyText]);

  // Extract variables from header (Meta text header supports at most {{1}})
  const headerVarKeys = useMemo(() => {
    const matches = Array.from(headerText.matchAll(/\{\{(\d+)\}\}/g));
    return Array.from(new Set(matches.map((m) => `header_${m[1]}`)));
  }, [headerText]);

  const allVarKeys = useMemo(() => {
    return [...headerVarKeys, ...bodyVarKeys];
  }, [headerVarKeys, bodyVarKeys]);

  const resolveFieldValue = useCallback(
    (field: string, cust: DashboardCustomer | null, fallback = ""): string => {
      if (!cust) return fallback;
      if (field === "customer.name") {
        return cust.customName || cust.whatsappName || fallback || "Customer";
      }
      if (field === "customer.customName") {
        return cust.customName || cust.whatsappName || fallback || "Customer";
      }
      if (field === "customer.whatsappName") {
        return cust.whatsappName || cust.customName || fallback || "Customer";
      }
      if (field === "customer.phoneNumber" || field === "phone") {
        return cust.phoneNumber || cust.normalizedPhone || "";
      }
      if (field === "customer.notes") {
        return cust.notes || fallback || "";
      }
      return fallback;
    },
    []
  );

  // Compute default configs based on template and heuristics
  const defaultConfigs = useMemo(() => {
    const configs: Record<string, VariableConfigItem> = {};
    if (!selectedTemplate) return configs;

    const bComp = selectedTemplate.components.find(
      (c) => String(c.type).toUpperCase() === "BODY"
    );
    const hComp = selectedTemplate.components.find(
      (c) =>
        String(c.type).toUpperCase() === "HEADER" &&
        (!c.format || c.format.toUpperCase() === "TEXT")
    );

    const bMappings =
      ((bComp?.examples as Record<string, unknown>)?.variableMappings as Record<
        string,
        {
          type?: "static" | "dynamic";
          field?: string;
          customField?: string;
          staticValue?: string;
          fallback?: string;
          sample?: string;
        }
      >) ||
      (
        (bComp as unknown as Record<string, unknown>)?.rawJson as {
          variableMappings?: Record<string, unknown>;
        }
      )?.variableMappings ||
      {};

    const hMapping =
      ((hComp?.examples as Record<string, unknown>)?.variableMapping as Record<
        string,
        unknown
      >) ||
      (
        (hComp as unknown as Record<string, unknown>)?.rawJson as {
          variableMapping?: Record<string, unknown>;
        }
      )?.variableMapping;

    // Header variable defaults
    for (const hk of headerVarKeys) {
      if (hMapping) {
        configs[hk] = {
          type: (hMapping.type as "static" | "dynamic") || "dynamic",
          field: (hMapping.field as string) || "customer.customName",
          staticValue:
            (hMapping.staticValue as string) ||
            (hMapping.sample as string) ||
            "",
          fallback: (hMapping.fallback as string) || "Customer"
        };
      } else {
        configs[hk] = {
          type: "dynamic",
          field: "customer.customName",
          staticValue: "",
          fallback: "Customer"
        };
      }
    }

    // Body variable defaults
    const lowerBody = (bComp?.text || "").toLowerCase();
    for (const bk of bodyVarKeys) {
      const raw = bMappings[bk] as
        | {
            type?: "static" | "dynamic";
            field?: string;
            customField?: string;
            staticValue?: string;
            fallback?: string;
            sample?: string;
          }
        | undefined;

      if (raw) {
        configs[bk] = {
          type: raw.type || "dynamic",
          field:
            raw.field === "custom" && raw.customField
              ? raw.customField
              : raw.field || "customer.name",
          staticValue: raw.staticValue || raw.sample || "",
          fallback: raw.fallback || "Customer"
        };
      } else {
        // Heuristic detection based on context and position
        const pattern = new RegExp(`([^.!?\\n]{0,35})\\{\\{${bk}\\}\\}`, "i");
        const match = lowerBody.match(pattern);
        const preceding = match ? match[1] : "";

        if (
          preceding.includes("custom name") ||
          preceding.includes("custom_name")
        ) {
          configs[bk] = {
            type: "dynamic",
            field: "customer.customName",
            staticValue: "",
            fallback: "Customer"
          };
        } else if (
          preceding.includes("number") ||
          preceding.includes("phone") ||
          preceding.includes("mobile") ||
          preceding.includes("contact")
        ) {
          configs[bk] = {
            type: "dynamic",
            field: "customer.phoneNumber",
            staticValue: "",
            fallback: ""
          };
        } else if (
          preceding.includes("dear") ||
          preceding.includes("hi") ||
          preceding.includes("hello") ||
          preceding.includes("name")
        ) {
          configs[bk] = {
            type: "dynamic",
            field: "customer.name",
            staticValue: "",
            fallback: "Customer"
          };
        } else if (bk === "1") {
          configs[bk] = {
            type: "dynamic",
            field: "customer.name",
            staticValue: "",
            fallback: "Customer"
          };
        } else if (bk === "2") {
          configs[bk] = {
            type: "dynamic",
            field: "customer.phoneNumber",
            staticValue: "",
            fallback: ""
          };
        } else if (bk === "3") {
          configs[bk] = {
            type: "dynamic",
            field: "customer.customName",
            staticValue: "",
            fallback: "Customer"
          };
        } else {
          configs[bk] = {
            type: "dynamic",
            field: "customer.customName",
            staticValue: "",
            fallback: "Customer"
          };
        }
      }
    }

    return configs;
  }, [selectedTemplate, headerVarKeys, bodyVarKeys]);

  // Merged variable configurations
  const effectiveConfigs = useMemo(() => {
    return { ...defaultConfigs, ...customConfigs };
  }, [defaultConfigs, customConfigs]);

  // Effective values per variable
  const effectiveValues = useMemo(() => {
    const values: Record<string, string> = {};
    for (const k of allVarKeys) {
      if (customValues[k] !== undefined) {
        values[k] = customValues[k];
      } else {
        const cfg = effectiveConfigs[k];
        if (cfg) {
          values[k] =
            cfg.type === "static"
              ? cfg.staticValue
              : resolveFieldValue(cfg.field, customer, cfg.fallback);
        } else {
          values[k] = "";
        }
      }
    }
    return values;
  }, [allVarKeys, customValues, effectiveConfigs, customer, resolveFieldValue]);

  // Live rendered previews
  const renderedHeaderText = useMemo(() => {
    if (!headerText) return null;
    let text = headerText;
    for (const k of headerVarKeys) {
      const rawNum = k.replace(/^header_/, "");
      const val = effectiveValues[k] || `{{${rawNum}}}`;
      text = text.replace(new RegExp(`\\{\\{${rawNum}\\}\\}`, "g"), val);
    }
    return text;
  }, [headerText, headerVarKeys, effectiveValues]);

  const renderedBodyText = useMemo(() => {
    if (!bodyText) return "";
    let text = bodyText;
    for (const k of bodyVarKeys) {
      const val = effectiveValues[k] || `{{${k}}}`;
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), val);
    }
    return text;
  }, [bodyText, bodyVarKeys, effectiveValues]);

  // Early returns placed AFTER all hooks
  if (!isOpen || !customer) return null;

  function handleSelectTemplate(id: string) {
    setSelectedTemplateId(id);
    setCustomConfigs({});
    setCustomValues({});
  }

  function handleConfigChange(
    key: string,
    updates: Partial<VariableConfigItem>
  ) {
    const current = effectiveConfigs[key] || {
      type: "dynamic",
      field: "customer.name",
      staticValue: "",
      fallback: "Customer"
    };
    const updated = { ...current, ...updates };

    setCustomConfigs((prev) => ({ ...prev, [key]: updated }));

    let nextVal = "";
    if (updated.type === "static") {
      nextVal = updated.staticValue;
    } else {
      nextVal = resolveFieldValue(updated.field, customer, updated.fallback);
    }
    setCustomValues((prev) => ({ ...prev, [key]: nextVal }));
  }

  function handleValueChange(key: string, val: string) {
    setCustomValues((prev) => ({ ...prev, [key]: val }));
    if (effectiveConfigs[key]?.type === "static") {
      setCustomConfigs((prev) => ({
        ...prev,
        [key]: { ...effectiveConfigs[key], staticValue: val }
      }));
    }
  }

  async function handleSend() {
    if (!customer) {
      toast.error("No recipient customer selected");
      return;
    }

    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    // Verify all variables have values
    for (const k of allVarKeys) {
      const displayKey = k.startsWith("header_")
        ? `Header {{${k.replace(/^header_/, "")}}}`
        : `{{${k}}}`;
      if (!effectiveValues[k]?.trim()) {
        toast.error(`Please provide a value for variable ${displayKey}`);
        return;
      }
    }

    setIsSending(true);

    try {
      const components: Array<{
        type: string;
        parameters: Array<{ type: string; text: string }>;
      }> = [];

      // Header parameters if any
      if (headerVarKeys.length > 0) {
        const hParams = headerVarKeys.map((k) => ({
          type: "text",
          text: effectiveValues[k]
        }));
        components.push({
          type: "header",
          parameters: hParams
        });
      }

      // Body parameters if any
      if (bodyVarKeys.length > 0) {
        const bParams = bodyVarKeys.map((k) => ({
          type: "text",
          text: effectiveValues[k]
        }));
        components.push({
          type: "body",
          parameters: bParams
        });
      }

      const res = await fetch("/api/messages/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          language: selectedTemplate.language || "en",
          components
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to send template");
      }

      toast.success("Template sent successfully");
      onSent();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to send template";
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 duration-150">
      <div className="border-border bg-card flex max-h-[92vh] w-full max-w-lg flex-col rounded-lg border p-5 shadow-2xl">
        {/* Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b pb-3">
          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <Layers className="text-cf-orange size-4" />
            <span>Send WhatsApp Template</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
          {/* Recipient info */}
          <div className="border-border bg-muted/30 flex items-center justify-between rounded border p-2.5 text-xs">
            <span className="text-muted-foreground">Recipient:</span>
            <span className="text-foreground font-semibold">
              {customer.customName || customer.whatsappName || "Customer"} (
              {formatDisplayPhone(customer.normalizedPhone)})
            </span>
          </div>

          {/* Template Selector */}
          <div className="space-y-1.5 text-xs">
            <label className="text-foreground font-semibold">
              Select Approved Template
            </label>
            <select
              value={activeTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
            >
              <option value="">-- Choose a template --</option>
              {approvedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.language.toUpperCase()}) - {t.category}
                </option>
              ))}
            </select>
            {approvedTemplates.length === 0 && (
              <p className="text-[11px] text-amber-600">
                {!canSendUtility && !canSendMarketing
                  ? "You do not have permission to send utility or marketing templates."
                  : 'No approved templates found in database. Use "Templates & Sync" to import from Meta.'}
              </p>
            )}
          </div>

          {/* Variables Configuration Section */}
          {allVarKeys.length > 0 && (
            <div className="border-border bg-muted/15 space-y-3 rounded-lg border p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-foreground flex items-center gap-1.5 font-semibold">
                  <Sparkles className="text-cf-orange size-3.5" />
                  <span>Template Variables</span>
                </label>
                <span className="text-muted-foreground text-[11px]">
                  {allVarKeys.length} wildcard{allVarKeys.length > 1 ? "s" : ""}{" "}
                  detected
                </span>
              </div>

              <div className="space-y-3">
                {allVarKeys.map((k) => {
                  const isHeader = k.startsWith("header_");
                  const displayLabel = isHeader
                    ? `Header {{${k.replace(/^header_/, "")}}}`
                    : `Variable {{${k}}}`;
                  const config = effectiveConfigs[k] || {
                    type: "dynamic",
                    field: "customer.name",
                    staticValue: "",
                    fallback: "Customer"
                  };
                  const currentValue = effectiveValues[k] || "";

                  return (
                    <div
                      key={k}
                      className="border-border bg-background space-y-2 rounded-md border p-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-foreground font-mono text-[11px] font-semibold">
                          {displayLabel}
                        </span>

                        {/* Static vs Dynamic Toggle */}
                        <div className="bg-muted inline-flex rounded p-0.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() =>
                              handleConfigChange(k, { type: "dynamic" })
                            }
                            className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-colors ${
                              config.type === "dynamic"
                                ? "bg-background text-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            ⚡ Dynamic
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleConfigChange(k, { type: "static" })
                            }
                            className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-colors ${
                              config.type === "static"
                                ? "bg-background text-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <Pin className="size-2.5" />
                              Static
                            </span>
                          </button>
                        </div>
                      </div>

                      {config.type === "dynamic" ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-muted-foreground text-[10px]">
                              Mapped CRM Field
                            </label>
                            <select
                              value={config.field}
                              onChange={(e) =>
                                handleConfigChange(k, {
                                  field: e.target.value
                                })
                              }
                              className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
                            >
                              {CRM_FIELDS.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-muted-foreground text-[10px]">
                              Live Resolved Value
                            </label>
                            <input
                              type="text"
                              value={currentValue}
                              onChange={(e) =>
                                handleValueChange(k, e.target.value)
                              }
                              placeholder="Resolved value..."
                              className="border-border bg-accent/20 text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-muted-foreground text-[10px]">
                            Static Text Value
                          </label>
                          <input
                            type="text"
                            value={currentValue}
                            onChange={(e) =>
                              handleValueChange(k, e.target.value)
                            }
                            placeholder={`Enter static value for ${displayLabel}...`}
                            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded border px-2.5 py-1 text-xs focus:ring-1 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Message Preview */}
          {selectedTemplate && (
            <div className="space-y-2 text-xs">
              <label className="text-foreground font-semibold">
                Live Message Preview
              </label>
              <div className="border-border bg-accent/30 text-foreground space-y-2 rounded-lg border p-3.5 leading-relaxed">
                {renderedHeaderText && (
                  <div className="text-foreground border-border/60 border-b pb-1.5 text-xs font-semibold">
                    {renderedHeaderText}
                  </div>
                )}
                <div className="font-sans text-xs whitespace-pre-wrap">
                  {renderedBodyText}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-border flex shrink-0 justify-end gap-2 border-t pt-3">
          <button
            type="button"
            onClick={onClose}
            className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded border px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!selectedTemplate || isSending}
            className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516] disabled:opacity-50"
          >
            {isSending && <Loader2 className="size-3.5 animate-spin" />}
            <span>Send Template Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
