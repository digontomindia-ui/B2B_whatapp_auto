"use client";

import React, { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  CheckSquare,
  Square,
  X,
  Loader2,
  Users,
  Filter,
  Database
} from "lucide-react";
import { toast } from "sonner";
import { EXPORTABLE_COLUMNS } from "@/server/customers/csv";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomerIds: Set<string>;
  totalCustomersCount: number;
  activeFilterParams: {
    search?: string;
    dateRange?: string;
    communicationState?: string;
    tag?: string;
  };
}

export function ExportDialog({
  isOpen,
  onClose,
  selectedCustomerIds,
  totalCustomersCount,
  activeFilterParams
}: ExportDialogProps) {
  // Scope: "selected" | "filtered" | "all"
  const defaultScope = selectedCustomerIds.size > 0 ? "selected" : "filtered";
  const [scope, setScope] = useState<"selected" | "filtered" | "all">(
    defaultScope
  );

  // Selected columns state (default all true)
  const [selectedColumns, setSelectedColumns] = useState<
    Record<string, boolean>
  >(
    Object.keys(EXPORTABLE_COLUMNS).reduce(
      (acc, k) => {
        acc[k] = true;
        return acc;
      },
      {} as Record<string, boolean>
    )
  );

  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  function toggleColumn(key: string) {
    setSelectedColumns((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  function selectAllColumns() {
    setSelectedColumns(
      Object.keys(EXPORTABLE_COLUMNS).reduce(
        (acc, k) => {
          acc[k] = true;
          return acc;
        },
        {} as Record<string, boolean>
      )
    );
  }

  function deselectAllColumns() {
    setSelectedColumns(
      Object.keys(EXPORTABLE_COLUMNS).reduce(
        (acc, k) => {
          acc[k] = false;
          return acc;
        },
        {} as Record<string, boolean>
      )
    );
  }

  const activeColumnCount =
    Object.values(selectedColumns).filter(Boolean).length;

  async function handleExecuteExport() {
    if (activeColumnCount === 0) {
      toast.error("Please select at least one column to export");
      return;
    }

    setIsExporting(true);

    try {
      const activeKeys = Object.keys(selectedColumns).filter(
        (k) => selectedColumns[k]
      );

      const payload: {
        customerIds?: string[];
        filterParams?: typeof activeFilterParams;
        columns: string[];
      } = {
        columns: activeKeys
      };

      if (scope === "selected") {
        payload.customerIds = Array.from(selectedCustomerIds);
      } else if (scope === "filtered") {
        payload.filterParams = activeFilterParams;
      }
      // if scope === "all", both customerIds and filterParams are omitted

      const res = await fetch("/api/customers/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Failed to generate CSV export");
      }

      // Read response as blob and trigger download
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      let filename = `whatsapp_contacts_${new Date().toISOString().slice(0, 10)}.csv`;

      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("CSV export downloaded successfully");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed";
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="border-border bg-card animate-in fade-in-50 zoom-in-95 relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="border-border bg-muted/20 flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-cf-orange/10 text-cf-orange border-cf-orange/20 rounded-lg border p-2">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h2 className="text-foreground text-sm font-semibold">
                Export Contacts to CSV
              </h2>
              <p className="text-muted-foreground text-[11px]">
                Download contacts with customizable fields and scopes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-md p-1.5"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="text-foreground block text-xs font-semibold">
              1. Choose Export Scope
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {/* Selected Contacts */}
              <button
                type="button"
                disabled={selectedCustomerIds.size === 0}
                onClick={() => setScope("selected")}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-3 text-xs transition-colors ${
                  scope === "selected"
                    ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                    : selectedCustomerIds.size === 0
                      ? "border-border/60 bg-muted/20 text-muted-foreground/50 cursor-not-allowed"
                      : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                <Users className="mb-1 size-4" />
                <span>Selected</span>
                <span className="text-muted-foreground text-[10px] font-normal">
                  ({selectedCustomerIds.size} checked)
                </span>
              </button>

              {/* Filtered Contacts */}
              <button
                type="button"
                onClick={() => setScope("filtered")}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-3 text-xs transition-colors ${
                  scope === "filtered"
                    ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                <Filter className="mb-1 size-4" />
                <span>Current Filter</span>
                <span className="text-muted-foreground text-[10px] font-normal">
                  (matching query)
                </span>
              </button>

              {/* All Contacts */}
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-3 text-xs transition-colors ${
                  scope === "all"
                    ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                <Database className="mb-1 size-4" />
                <span>All Contacts</span>
                <span className="text-muted-foreground text-[10px] font-normal">
                  ({totalCustomersCount} total)
                </span>
              </button>
            </div>
          </div>

          {/* Column Selector */}
          <div className="border-border space-y-2 border-t pt-2">
            <div className="flex items-center justify-between">
              <label className="text-foreground text-xs font-semibold">
                2. Select Columns to Include ({activeColumnCount}/
                {Object.keys(EXPORTABLE_COLUMNS).length})
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAllColumns}
                  className="text-cf-orange cursor-pointer hover:underline"
                >
                  Select All
                </button>
                <span className="text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={deselectAllColumns}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(EXPORTABLE_COLUMNS).map(([key, label]) => {
                const isChecked = !!selectedColumns[key];
                return (
                  <label
                    key={key}
                    onClick={() => toggleColumn(key)}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors select-none ${
                      isChecked
                        ? "border-cf-orange/40 bg-cf-orange/5 text-foreground"
                        : "border-border bg-muted/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="text-cf-orange size-4 shrink-0" />
                    ) : (
                      <Square className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <span className="truncate">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-border bg-muted/20 flex items-center justify-between border-t px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isExporting || activeColumnCount === 0}
            onClick={handleExecuteExport}
            className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#e87516] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Exporting CSV...</span>
              </>
            ) : (
              <>
                <Download className="size-3.5" />
                <span>Download CSV ({activeColumnCount} columns)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
