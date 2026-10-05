"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Layers, Loader2, X } from "lucide-react";
import type { DashboardCustomer, DashboardTemplate } from "./types";
import { formatDisplayPhone } from "@/utils/phone";

interface SendTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: DashboardCustomer | null;
  templates: DashboardTemplate[];
  onSent: () => void;
}

export function SendTemplateDialog({
  isOpen,
  onClose,
  customer,
  templates,
  onSent
}: SendTemplateDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {}
  );
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !customer) return null;

  const approvedTemplates = templates.filter(
    (t) => t.status === "APPROVED" || t.status === "PENDING"
  );

  const selectedTemplate = approvedTemplates.find(
    (t) => t.id === selectedTemplateId
  );

  const bodyComponent = selectedTemplate?.components.find(
    (c) => c.type === "BODY"
  );

  // Extract variables like {{1}}, {{2}} from body text
  const bodyText = bodyComponent?.text || "";
  const variableMatches = Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g));
  const variableKeys = Array.from(new Set(variableMatches.map((m) => m[1])));

  function handleSelectTemplate(id: string) {
    setSelectedTemplateId(id);
    setVariableValues({});
  }

  function handleVariableChange(key: string, val: string) {
    setVariableValues((prev) => ({ ...prev, [key]: val }));
  }

  // Render preview by substituting variables
  let previewText = bodyText;
  for (const k of variableKeys) {
    const val = variableValues[k] || `{{${k}}}`;
    previewText = previewText.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), val);
  }

  async function handleSend() {
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    // Verify all variables are filled
    for (const k of variableKeys) {
      if (!variableValues[k]?.trim()) {
        toast.error(`Please provide value for variable {{${k}}}`);
        return;
      }
    }

    setIsSending(true);

    try {
      // Build Meta components format
      const parameters = variableKeys.map((k) => ({
        type: "text",
        text: variableValues[k]
      }));

      const components =
        parameters.length > 0
          ? [
              {
                type: "body",
                parameters
              }
            ]
          : [];

      const res = await fetch("/api/messages/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer!.id,
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
      <div className="border-border bg-card w-full max-w-lg space-y-4 rounded-lg border p-5 shadow-2xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b pb-3">
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
            value={selectedTemplateId}
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
              No approved templates found in database. Use &quot;Templates &amp;
              Sync&quot; to import from Meta.
            </p>
          )}
        </div>

        {/* Variable Inputs */}
        {variableKeys.length > 0 && (
          <div className="border-border bg-muted/10 space-y-2 rounded border p-3 text-xs">
            <label className="text-foreground font-semibold">
              Template Variables
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {variableKeys.map((k) => (
                <div key={k} className="space-y-1">
                  <span className="text-muted-foreground font-mono text-[11px]">
                    Variable &#123;&#123;{k}&#125;&#125;
                  </span>
                  <input
                    type="text"
                    required
                    value={variableValues[k] || ""}
                    onChange={(e) => handleVariableChange(k, e.target.value)}
                    placeholder={`Value for {{${k}}}`}
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded border px-2.5 py-1 text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Preview */}
        {selectedTemplate && (
          <div className="space-y-3 text-xs">
            <label className="text-foreground font-semibold">
              Live Message Preview
            </label>
            <div className="border-border bg-accent/40 text-foreground max-h-60 overflow-auto rounded-lg border p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap">
              {previewText}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-border flex justify-end gap-2 border-t pt-2">
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
