"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Layers, Loader2, X } from "lucide-react";
import type { DashboardCustomer, DashboardTemplate } from "./types";

interface BulkTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomers: DashboardCustomer[];
  templates: DashboardTemplate[];
  onStarted: () => void;
}

export function BulkTemplateDialog({
  isOpen,
  onClose,
  selectedCustomers,
  templates,
  onStarted
}: BulkTemplateDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [allowOverride, setAllowOverride] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const total = selectedCustomers.length;
  const blockedCount = selectedCustomers.filter((c) => c.state === "BLOCKED").length;
  const optedOutCount = selectedCustomers.filter((c) => c.state === "OPTED_OUT").length;
  const activeCount = selectedCustomers.filter((c) => c.state === "ACTIVE").length;
  const eligibleCount = allowOverride ? total : activeCount;

  const approvedTemplates = templates.filter(
    (t) => t.status === "APPROVED" || t.status === "PENDING"
  );
  const selectedTemplate = approvedTemplates.find((t) => t.id === selectedTemplateId);
  const bodyComponent = selectedTemplate?.components.find((c) => c.type === "BODY");
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

  let previewText = bodyText;
  for (const k of variableKeys) {
    const val = variableValues[k] || `{{${k}}}`;
    previewText = previewText.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), val);
  }

  async function handleConfirm() {
    if (eligibleCount === 0) {
      toast.error("No eligible recipients selected");
      return;
    }
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }
    for (const k of variableKeys) {
      if (!variableValues[k]?.trim()) {
        toast.error(`Please provide value for variable {{${k}}}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const recipientIds = allowOverride
        ? selectedCustomers.map((c) => c.id)
        : selectedCustomers.filter((c) => c.state === "ACTIVE").map((c) => c.id);

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

      const res = await fetch("/api/bulk/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          language: selectedTemplate.language || "en",
          components,
          customerIds: recipientIds,
          allowOverrideBlocked: allowOverride
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to initiate template broadcast");
      }

      toast.success(`Template broadcast initiated for ${eligibleCount} customers!`);
      onStarted();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to broadcast template";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-2xl space-y-4 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <Layers className="size-4 text-cf-orange" />
            <span>Send Bulk WhatsApp Template</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Recipients Breakdown Card */}
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1 text-xs">
          <div className="flex justify-between font-semibold text-foreground">
            <span>Selected Recipients:</span>
            <span>{total} customers</span>
          </div>
          <div className="flex justify-between text-muted-foreground text-[11px]">
            <span>Eligible for template broadcast:</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {eligibleCount}
            </span>
          </div>
          {blockedCount > 0 && (
            <div className="flex justify-between text-muted-foreground text-[11px]">
              <span>Blocked (excluded):</span>
              <span className="text-red-500">{blockedCount}</span>
            </div>
          )}
          {optedOutCount > 0 && (
            <div className="flex justify-between text-muted-foreground text-[11px]">
              <span>Opted out (excluded):</span>
              <span className="text-amber-500">{optedOutCount}</span>
            </div>
          )}
        </div>

        {/* Template Selector */}
        <div className="space-y-1.5">
          <label className="font-semibold text-foreground">
            Select Approved Template
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleSelectTemplate(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange cursor-pointer"
          >
            <option value="">-- Choose a template --</option>
            {approvedTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.language.toUpperCase()}) - {t.category}
              </option>
            ))}
          </select>
        </div>

        {/* Variables */}
        {variableKeys.length > 0 && (
          <div className="space-y-2 border border-border rounded p-3 bg-muted/10">
            <label className="font-semibold text-foreground">
              Broadcast Variables
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {variableKeys.map((k) => (
                <div key={k} className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Variable &#123;&#123;{k}&#125;&#125;
                  </span>
                  <input
                    type="text"
                    required
                    value={variableValues[k] || ""}
                    onChange={(e) => handleVariableChange(k, e.target.value)}
                    placeholder={`Value for {{${k}}}`}
                    className="w-full rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Preview */}
        {selectedTemplate && (
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Live Preview</label>
            <div className="rounded-lg border border-border bg-accent/40 p-3 text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {previewText}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedTemplate || eligibleCount === 0 || isSubmitting}
            className="inline-flex items-center gap-1.5 rounded bg-cf-orange px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516] cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Layers className="size-3.5" />
            )}
            <span>Broadcast to {eligibleCount} recipients</span>
          </button>
        </div>
      </div>
    </div>
  );
}
