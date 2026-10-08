"use client";

import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  CheckSquare,
  Square,
  Database,
  Users,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { EXPORTABLE_COLUMNS, type ImportResult } from "@/server/customers/csv";
import type { DashboardCustomer } from "@/components/dashboard/types";
import { formatDisplayPhone } from "@/utils/phone";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { Lock } from "lucide-react";

export default function ImportExportPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isOwner } = useAuth();

  const canImport = isOwner || hasPermission(PERMISSIONS.CUSTOMER_IMPORT);
  const canExport = isOwner || hasPermission(PERMISSIONS.CUSTOMER_EXPORT);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"import" | "export">(() => {
    if (!canImport && canExport) return "export";
    return "import";
  });

  // -------------------------------------------------------------
  // IMPORT STATE
  // -------------------------------------------------------------
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Array<Record<string, string>>>(
    []
  );
  const [selectedImportRowIndices, setSelectedImportRowIndices] = useState<
    Set<number>
  >(new Set());
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [defaultTag, setDefaultTag] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------------------------------------------------
  // EXPORT STATE
  // -------------------------------------------------------------
  const [exportScope, setExportScope] = useState<
    "selected" | "all" | "active" | "blocked" | "opted_out"
  >("all");
  const [selectedExportCustomerIds, setSelectedExportCustomerIds] = useState<
    Set<string>
  >(new Set());
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

  // -------------------------------------------------------------
  // FETCH CUSTOMERS FOR EXPORT PREVIEW
  // -------------------------------------------------------------
  const [contactSearch, setContactSearch] = useState("");
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery<{
    customers: DashboardCustomer[];
    pagination: { total: number };
  }>({
    queryKey: ["customers", contactSearch],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (contactSearch) p.set("search", contactSearch);
      p.set("limit", "100");
      const res = await fetch(`/api/customers?${p.toString()}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    }
  });

  const customers = customersData?.customers || [];
  const totalCount = customersData?.pagination?.total || customers.length;

  // -------------------------------------------------------------
  // IMPORT HANDLERS
  // -------------------------------------------------------------
  function handleFileChange(selectedFile: File) {
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a valid .csv file");
      return;
    }

    setImportFile(selectedFile);
    setImportResult(null);

    Papa.parse<Record<string, string>>(selectedFile, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          toast.error(
            "Failed to parse CSV file: " + results.errors[0]?.message
          );
          return;
        }
        setDetectedHeaders(results.meta.fields || []);
        setParsedRows(results.data);
        // Default select all parsed rows
        setSelectedImportRowIndices(new Set(results.data.map((_, i) => i)));
      },
      error: (err) => {
        toast.error("Error reading CSV file: " + err.message);
      }
    });
  }

  function toggleImportRow(idx: number) {
    setSelectedImportRowIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleSelectAllImportRows() {
    if (selectedImportRowIndices.size === parsedRows.length) {
      setSelectedImportRowIndices(new Set());
    } else {
      setSelectedImportRowIndices(new Set(parsedRows.map((_, i) => i)));
    }
  }

  function downloadSampleCsv() {
    const sampleData = [
      {
        phone: "+91 90461 13306",
        name: "Aquib Alam",
        tags: "Admission 2026, VIP",
        notes: "Met at education fair, requested fee details",
        state: "ACTIVE"
      },
      {
        phone: "+91 98765 43210",
        name: "John Doe",
        tags: "Lead",
        notes: "Follow up next Monday",
        state: "ACTIVE"
      },
      {
        phone: "+91 88888 77777",
        name: "Priya Sharma",
        tags: "Alumni",
        notes: "Prefers email notifications",
        state: "OPTED_OUT"
      }
    ];

    const csvContent = Papa.unparse(sampleData, { header: true });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample_contacts_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Sample template downloaded");
  }

  async function handleExecuteImport() {
    if (!canImport) {
      toast.error("You do not have permission to import contacts");
      return;
    }

    const rowsToImport = parsedRows.filter((_, idx) =>
      selectedImportRowIndices.has(idx)
    );

    if (rowsToImport.length === 0) {
      toast.error("Please select at least one contact row to import");
      return;
    }

    setIsImporting(true);

    try {
      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rowsToImport,
          options: {
            updateExisting,
            defaultTag: defaultTag.trim() || undefined
          }
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Import failed");
      }

      setImportResult(json.data);
      toast.success(json.message);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  }

  // -------------------------------------------------------------
  // EXPORT HANDLERS
  // -------------------------------------------------------------
  function toggleExportCustomer(id: string) {
    setSelectedExportCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllExportCustomers() {
    if (
      selectedExportCustomerIds.size === customers.length &&
      customers.length > 0
    ) {
      setSelectedExportCustomerIds(new Set());
    } else {
      setSelectedExportCustomerIds(new Set(customers.map((c) => c.id)));
    }
  }

  function toggleColumn(key: string) {
    setSelectedColumns((prev) => ({ ...prev, [key]: !prev[key] }));
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
    if (!canExport) {
      toast.error("You do not have permission to export contacts");
      return;
    }

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
        filterParams?: { communicationState?: string };
        columns: string[];
      } = {
        columns: activeKeys
      };

      if (exportScope === "selected" || selectedExportCustomerIds.size > 0) {
        payload.customerIds = Array.from(selectedExportCustomerIds);
      } else if (exportScope !== "all") {
        payload.filterParams = { communicationState: exportScope };
      }

      const res = await fetch("/api/customers/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Failed to generate CSV export");
      }

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed";
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  }

  // Column matching detection
  function findMatchingHeader(keywords: string[]): string | null {
    const found = detectedHeaders.find((h) => {
      const cleaned = h
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
      return keywords.some(
        (k) => cleaned === k.toLowerCase().replace(/[\s_-]+/g, "")
      );
    });
    return found || null;
  }

  const phoneHeader = findMatchingHeader([
    "phone",
    "phonenumber",
    "mobile",
    "contact",
    "number",
    "whatsapp"
  ]);
  const nameHeader = findMatchingHeader([
    "name",
    "customname",
    "fullname",
    "contactname",
    "firstname"
  ]);
  const tagsHeader = findMatchingHeader([
    "tags",
    "tag",
    "labels",
    "label",
    "groups"
  ]);
  const notesHeader = findMatchingHeader([
    "notes",
    "note",
    "remarks",
    "comment"
  ]);
  const stateHeader = findMatchingHeader(["state", "status"]);

  if (!canImport && !canExport) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="bg-destructive/10 text-destructive mb-3 rounded-full p-3">
          <Lock className="size-6" />
        </div>
        <h2 className="text-foreground text-base font-semibold">
          Access Restricted
        </h2>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          You do not have permission to import or export contacts. Contact your
          administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden">
      {/* Top Tab Bar & Summary Header */}
      <div className="border-border bg-card shrink-0 space-y-3 border-b p-4 shadow-2xs">
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          {/* Tabs */}
          <div className="border-border bg-muted/40 flex items-center gap-1.5 rounded-lg border p-1">
            {canImport && (
              <button
                onClick={() => setActiveTab("import")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === "import"
                    ? "bg-background text-cf-orange shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="size-3.5" />
                <span>Import Contacts</span>
              </button>
            )}

            {canExport && (
              <button
                onClick={() => setActiveTab("export")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === "export"
                    ? "bg-background text-cf-orange shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Download className="size-3.5" />
                <span>Export Contacts</span>
              </button>
            )}
          </div>

          {/* Database Total Pill */}
          <div className="flex items-center gap-2 text-xs">
            <div className="bg-muted/60 border-border flex items-center gap-2 rounded-md border px-3 py-1.5">
              <Database className="text-muted-foreground size-3.5" />
              <span className="text-muted-foreground">Total CRM Contacts:</span>
              <strong className="text-foreground font-mono">
                {totalCount}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabbed Area */}
      <div className="bg-muted/10 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {activeTab === "import" && canImport ? (
          /* ========================================================= */
          /* IMPORT TAB CONTENT */
          /* ========================================================= */
          <div className="mx-auto max-w-4xl space-y-5">
            {/* Post-Import Results Card */}
            {importResult && (
              <div className="bg-card space-y-4 rounded-xl border border-emerald-500/30 p-5 shadow-xs">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                  <div>
                    <h3 className="text-foreground text-sm font-bold">
                      Import Completed
                    </h3>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Contacts processed with phone normalization and duplicate
                      merging.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="bg-background border-border rounded-lg border p-3 text-center">
                    <div className="text-muted-foreground text-[10px] font-semibold uppercase">
                      Total Rows
                    </div>
                    <div className="text-foreground mt-1 text-xl font-bold">
                      {importResult.totalRows}
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
                    <div className="text-[10px] font-semibold text-emerald-600 uppercase dark:text-emerald-400">
                      Created
                    </div>
                    <div className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {importResult.createdCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-center">
                    <div className="text-[10px] font-semibold text-blue-600 uppercase dark:text-blue-400">
                      Updated
                    </div>
                    <div className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">
                      {importResult.updatedCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center">
                    <div className="text-[10px] font-semibold text-red-600 uppercase dark:text-red-400">
                      Errors
                    </div>
                    <div className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">
                      {importResult.errorCount}
                    </div>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="bg-destructive/5 border-destructive/20 space-y-2 rounded-lg border p-3">
                    <div className="text-destructive flex items-center gap-1.5 text-xs font-bold">
                      <AlertCircle className="size-3.5" />
                      <span>Failed Rows ({importResult.errors.length})</span>
                    </div>
                    <div className="max-h-36 space-y-1 overflow-y-auto font-mono text-[11px]">
                      {importResult.errors.map((err, i) => (
                        <div
                          key={i}
                          className="bg-card border-border flex justify-between rounded border p-1.5"
                        >
                          <span>
                            Row {err.row}: {err.phone || "(no phone)"}
                          </span>
                          <span className="text-destructive font-sans">
                            {err.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setImportFile(null);
                    setParsedRows([]);
                    setSelectedImportRowIndices(new Set());
                    setDetectedHeaders([]);
                    setImportResult(null);
                  }}
                  className="bg-cf-orange cursor-pointer rounded-md px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516]"
                >
                  Import Another File
                </button>
              </div>
            )}

            {!importResult && (
              <>
                {/* File Drop Area */}
                <div className="border-border bg-card space-y-4 rounded-xl border p-6 shadow-xs">
                  <div className="border-border flex items-center justify-between border-b pb-3">
                    <div>
                      <h3 className="text-foreground text-sm font-bold">
                        Step 1: Upload CSV File
                      </h3>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Accepts standard CSV with headers for phone, name, tags,
                        notes, and status
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadSampleCsv}
                      className="text-cf-orange inline-flex cursor-pointer items-center gap-1 text-xs font-semibold hover:underline"
                    >
                      <Download className="size-3.5" />
                      <span>Download Sample Template</span>
                    </button>
                  </div>

                  {!importFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files?.[0])
                          handleFileChange(e.dataTransfer.files[0]);
                      }}
                      className="border-border hover:border-cf-orange/60 bg-muted/10 hover:bg-muted/30 group cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0])
                            handleFileChange(e.target.files[0]);
                        }}
                      />
                      <div className="bg-cf-orange/10 group-hover:bg-cf-orange/20 text-cf-orange mx-auto mb-3 flex size-12 items-center justify-center rounded-full transition-colors">
                        <Upload className="size-6" />
                      </div>
                      <p className="text-foreground text-xs font-semibold">
                        Click to select CSV file or drag & drop here
                      </p>
                      <p className="text-muted-foreground mt-1 text-[11px]">
                        Files must be in UTF-8 .csv format
                      </p>
                    </div>
                  ) : (
                    <div className="border-border bg-muted/30 flex items-center justify-between rounded-lg border p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="bg-cf-orange/15 text-cf-orange rounded p-2">
                          <FileSpreadsheet className="size-5" />
                        </div>
                        <div>
                          <div className="text-foreground flex items-center gap-2 text-xs font-semibold">
                            <span>{importFile.name}</span>
                            <span className="bg-muted py-0.2 text-muted-foreground rounded px-1.5 font-mono text-[10px]">
                              {parsedRows.length} rows detected
                            </span>
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-[11px]">
                            {(importFile.size / 1024).toFixed(1)} KB • CSV
                            Format
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setImportFile(null);
                          setParsedRows([]);
                          setSelectedImportRowIndices(new Set());
                          setDetectedHeaders([]);
                        }}
                        className="border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded border px-2.5 py-1 text-xs"
                      >
                        Change File
                      </button>
                    </div>
                  )}
                </div>

                {/* Detected Header Mapping */}
                {detectedHeaders.length > 0 && (
                  <div className="border-border bg-card space-y-3 rounded-xl border p-5 shadow-xs">
                    <div className="border-border flex items-center justify-between border-b pb-2">
                      <h3 className="text-foreground text-xs font-bold">
                        Step 2: Detected Column Mapping
                      </h3>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {detectedHeaders.length} total headers
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                      <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                        <span className="text-muted-foreground text-[10px] font-bold uppercase">
                          Phone (Required)
                        </span>
                        <div className="text-foreground mt-1 flex items-center gap-1 font-mono font-medium">
                          {phoneHeader ? (
                            <>
                              <Check className="size-3 text-emerald-500" />
                              <span className="truncate">{phoneHeader}</span>
                            </>
                          ) : (
                            <span className="text-destructive flex items-center gap-1 font-semibold">
                              <AlertCircle className="size-3" /> Missing!
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                        <span className="text-muted-foreground text-[10px] font-bold uppercase">
                          Name
                        </span>
                        <div className="text-foreground mt-1 truncate font-mono">
                          {nameHeader || (
                            <span className="text-muted-foreground italic">
                              (optional)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                        <span className="text-muted-foreground text-[10px] font-bold uppercase">
                          Tags
                        </span>
                        <div className="text-foreground mt-1 truncate font-mono">
                          {tagsHeader || (
                            <span className="text-muted-foreground italic">
                              (optional)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                        <span className="text-muted-foreground text-[10px] font-bold uppercase">
                          Notes
                        </span>
                        <div className="text-foreground mt-1 truncate font-mono">
                          {notesHeader || (
                            <span className="text-muted-foreground italic">
                              (optional)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                        <span className="text-muted-foreground text-[10px] font-bold uppercase">
                          Status
                        </span>
                        <div className="text-foreground mt-1 truncate font-mono">
                          {stateHeader || (
                            <span className="text-muted-foreground italic">
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Import Settings */}
                {parsedRows.length > 0 && (
                  <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-xs">
                    <h3 className="text-foreground border-border border-b pb-2 text-xs font-bold">
                      Step 3: Configuration & Duplication Strategy
                    </h3>

                    <div className="space-y-3">
                      <label className="flex cursor-pointer items-start gap-2.5 text-xs">
                        <input
                          type="checkbox"
                          checked={updateExisting}
                          onChange={(e) => setUpdateExisting(e.target.checked)}
                          className="border-border text-cf-orange focus:ring-cf-orange mt-0.5 cursor-pointer rounded"
                        />
                        <div>
                          <span className="text-foreground font-semibold">
                            Update & merge existing contacts (Recommended)
                          </span>
                          <p className="text-muted-foreground text-[11px]">
                            If phone exists in CRM, update name, notes, and
                            merge tags instead of skipping.
                          </p>
                        </div>
                      </label>

                      <div>
                        <label className="text-muted-foreground block text-[11px] font-semibold">
                          Attach common tag to all imported contacts (optional)
                        </label>
                        <input
                          type="text"
                          value={defaultTag}
                          onChange={(e) => setDefaultTag(e.target.value)}
                          placeholder="e.g. October Batch 2026, Education Expo"
                          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full max-w-md rounded-md border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Data Preview with Row Checkboxes */}
                {parsedRows.length > 0 && (
                  <div className="border-border bg-card space-y-3 rounded-xl border p-5 shadow-xs">
                    <div className="border-border text-foreground flex items-center justify-between border-b pb-2 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span>Step 4: Data Preview & Row Selection</span>
                        <span className="bg-cf-orange/10 text-cf-orange rounded-full px-2 py-0.5 font-mono text-[10px] font-medium">
                          {selectedImportRowIndices.size} of {parsedRows.length}{" "}
                          selected
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImportRowIndices(
                              new Set(parsedRows.map((_, i) => i))
                            )
                          }
                          className="text-cf-orange cursor-pointer hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-muted-foreground">•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedImportRowIndices(new Set())}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    <div className="border-border max-h-72 overflow-x-auto rounded-lg border">
                      <table className="w-full border-collapse text-left text-[11px]">
                        <thead className="bg-muted/60 text-muted-foreground border-border sticky top-0 border-b">
                          <tr>
                            <th className="w-10 p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={
                                  selectedImportRowIndices.size ===
                                    parsedRows.length && parsedRows.length > 0
                                }
                                onChange={toggleSelectAllImportRows}
                                className="border-border text-cf-orange focus:ring-cf-orange cursor-pointer rounded"
                                title="Select / Deselect all rows"
                              />
                            </th>
                            <th className="p-2.5 font-medium">#</th>
                            {detectedHeaders.slice(0, 6).map((h, i) => (
                              <th
                                key={i}
                                className="max-w-[150px] truncate p-2.5 font-medium"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-border/60 divide-y">
                          {parsedRows.map((row, idx) => {
                            const isChecked = selectedImportRowIndices.has(idx);
                            return (
                              <tr
                                key={idx}
                                onClick={() => toggleImportRow(idx)}
                                className={`cursor-pointer transition-colors ${
                                  isChecked
                                    ? "bg-cf-orange/5 hover:bg-cf-orange/10"
                                    : "hover:bg-muted/20 opacity-50"
                                }`}
                              >
                                <td
                                  className="p-2.5 text-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleImportRow(idx)}
                                    className="border-border text-cf-orange focus:ring-cf-orange cursor-pointer rounded"
                                  />
                                </td>
                                <td className="text-muted-foreground p-2.5 font-mono">
                                  {idx + 1}
                                </td>
                                {detectedHeaders.slice(0, 6).map((h, i) => (
                                  <td
                                    key={i}
                                    className="text-foreground max-w-[150px] truncate p-2.5"
                                  >
                                    {row[h] || (
                                      <span className="text-muted-foreground/40 italic">
                                        —
                                      </span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="border-border flex items-center justify-between border-t pt-3">
                      <span className="text-muted-foreground text-xs">
                        Ready to import{" "}
                        <strong>{selectedImportRowIndices.size}</strong> checked
                        contacts
                      </span>

                      <button
                        onClick={handleExecuteImport}
                        disabled={
                          isImporting ||
                          selectedImportRowIndices.size === 0 ||
                          !phoneHeader
                        }
                        className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#e87516] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>
                              Processing {selectedImportRowIndices.size}{" "}
                              Contacts...
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload className="size-3.5" />
                            <span>
                              Import {selectedImportRowIndices.size} Selected
                              Contacts
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* EXPORT TAB CONTENT */
          /* ========================================================= */
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="border-border bg-card space-y-5 rounded-xl border p-6 shadow-xs">
              <div className="border-border border-b pb-3">
                <h3 className="text-foreground text-sm font-bold">
                  Export Contacts Database
                </h3>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Download an official CSV backup or selective export with
                  custom column choices
                </p>
              </div>

              {/* 1. Scope Selection */}
              <div className="space-y-2">
                <label className="text-foreground block text-xs font-bold">
                  1. Select Export Scope
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  <button
                    type="button"
                    onClick={() => setExportScope("selected")}
                    disabled={selectedExportCustomerIds.size === 0}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-3 transition-colors ${
                      exportScope === "selected"
                        ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-bold"
                        : selectedExportCustomerIds.size === 0
                          ? "border-border/50 bg-muted/20 text-muted-foreground/40 cursor-not-allowed"
                          : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <CheckSquare className="mb-1 size-4" />
                    <span>Selected</span>
                    <span className="text-muted-foreground text-[10px] font-normal">
                      ({selectedExportCustomerIds.size} checked)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportScope("all")}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-3 transition-colors ${
                      exportScope === "all"
                        ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-bold"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <Database className="mb-1 size-4" />
                    <span>All Contacts</span>
                    <span className="text-muted-foreground text-[10px] font-normal">
                      ({totalCount})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportScope("active")}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-3 transition-colors ${
                      exportScope === "active"
                        ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-bold"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <Users className="mb-1 size-4" />
                    <span>Active Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportScope("blocked")}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-3 transition-colors ${
                      exportScope === "blocked"
                        ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-bold"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <AlertCircle className="mb-1 size-4 text-red-500" />
                    <span>Blocked</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportScope("opted_out")}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-3 transition-colors ${
                      exportScope === "opted_out"
                        ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-bold"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <AlertCircle className="mb-1 size-4 text-amber-500" />
                    <span>Opted Out</span>
                  </button>
                </div>
              </div>

              {/* 2. Column Toggles */}
              <div className="border-border space-y-2 border-t pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-foreground text-xs font-bold">
                    2. Select Columns to Include ({activeColumnCount}/
                    {Object.keys(EXPORTABLE_COLUMNS).length})
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      onClick={selectAllColumns}
                      className="text-cf-orange cursor-pointer hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      onClick={deselectAllColumns}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {Object.entries(EXPORTABLE_COLUMNS).map(([key, label]) => {
                    const isChecked = !!selectedColumns[key];
                    return (
                      <div
                        key={key}
                        onClick={() => toggleColumn(key)}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors select-none ${
                          isChecked
                            ? "border-cf-orange/40 bg-cf-orange/5 text-foreground font-medium"
                            : "border-border bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="text-cf-orange size-4 shrink-0" />
                        ) : (
                          <Square className="text-muted-foreground size-4 shrink-0" />
                        )}
                        <span className="truncate">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Export Data Preview Table with Row Checkboxes */}
              <div className="border-border space-y-2 border-t pt-2">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <label className="text-foreground text-xs font-bold">
                    3. Contact Preview & Selective Checkboxes
                  </label>
                  <div className="flex items-center gap-2">
                    {/* Search inside preview */}
                    <div className="relative min-w-40">
                      <Search className="text-muted-foreground absolute top-1/2 left-2 size-3 -translate-y-1/2" />
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder="Search preview..."
                        className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded border py-1 pr-2.5 pl-6 text-[11px] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={toggleSelectAllExportCustomers}
                      className="text-cf-orange cursor-pointer text-[11px] whitespace-nowrap hover:underline"
                    >
                      {selectedExportCustomerIds.size === customers.length &&
                      customers.length > 0
                        ? "Deselect All"
                        : "Select All Visible"}
                    </button>
                  </div>
                </div>

                <div className="border-border max-h-64 overflow-x-auto rounded-lg border">
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead className="bg-muted/60 text-muted-foreground border-border sticky top-0 border-b">
                      <tr>
                        <th className="w-10 p-2 text-center">
                          <input
                            type="checkbox"
                            checked={
                              selectedExportCustomerIds.size ===
                                customers.length && customers.length > 0
                            }
                            onChange={toggleSelectAllExportCustomers}
                            className="border-border text-cf-orange focus:ring-cf-orange cursor-pointer rounded"
                            title="Select / Deselect all contacts"
                          />
                        </th>
                        <th className="p-2 font-medium">Contact</th>
                        <th className="p-2 font-medium">WhatsApp Profile</th>
                        <th className="p-2 font-medium">Status</th>
                        <th className="p-2 font-medium">Tags</th>
                        <th className="p-2 font-medium">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border/60 divide-y">
                      {isLoadingCustomers ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-muted-foreground p-4 text-center"
                          >
                            Loading contacts preview...
                          </td>
                        </tr>
                      ) : customers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-muted-foreground p-4 text-center"
                          >
                            No contacts match search filter
                          </td>
                        </tr>
                      ) : (
                        customers.map((c) => {
                          const isChecked = selectedExportCustomerIds.has(c.id);
                          return (
                            <tr
                              key={c.id}
                              onClick={() => {
                                toggleExportCustomer(c.id);
                                if (exportScope !== "selected")
                                  setExportScope("selected");
                              }}
                              className={`cursor-pointer transition-colors ${
                                isChecked
                                  ? "bg-cf-orange/5 hover:bg-cf-orange/10"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <td
                                className="p-2 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    toggleExportCustomer(c.id);
                                    if (exportScope !== "selected")
                                      setExportScope("selected");
                                  }}
                                  className="border-border text-cf-orange focus:ring-cf-orange cursor-pointer rounded"
                                />
                              </td>
                              <td className="text-foreground p-2 font-mono">
                                {formatDisplayPhone(c.normalizedPhone)}
                                {c.customName && (
                                  <span className="text-muted-foreground block font-sans text-[10px] font-medium">
                                    {c.customName}
                                  </span>
                                )}
                              </td>
                              <td className="text-muted-foreground p-2">
                                {c.whatsappName || "—"}
                              </td>
                              <td className="p-2">
                                <span
                                  className={`py-0.2 rounded-full px-2 text-[10px] font-semibold ${
                                    c.state === "ACTIVE"
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : c.state === "BLOCKED"
                                        ? "bg-red-500/10 text-red-600"
                                        : "bg-amber-500/10 text-amber-600"
                                  }`}
                                >
                                  {c.state}
                                </span>
                              </td>
                              <td className="text-muted-foreground max-w-[120px] truncate p-2">
                                {c.tags?.map((t) => t.tag.name).join(", ") ||
                                  "—"}
                              </td>
                              <td className="text-muted-foreground p-2 font-mono text-[10px]">
                                {c.lastInteractionAt
                                  ? new Date(
                                      c.lastInteractionAt
                                    ).toLocaleDateString()
                                  : "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Export Trigger Footer */}
              <div className="border-border flex items-center justify-between border-t pt-4">
                <span className="text-muted-foreground text-xs">
                  {selectedExportCustomerIds.size > 0 ? (
                    <>
                      Exporting{" "}
                      <strong>{selectedExportCustomerIds.size}</strong> checked
                      contacts across <strong>{activeColumnCount}</strong>{" "}
                      columns
                    </>
                  ) : (
                    <>
                      Exporting <strong>{exportScope.toUpperCase()}</strong>{" "}
                      scope across <strong>{activeColumnCount}</strong> columns
                    </>
                  )}
                </span>

                <button
                  onClick={handleExecuteExport}
                  disabled={isExporting || activeColumnCount === 0}
                  className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#e87516] disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Generating CSV...</span>
                    </>
                  ) : (
                    <>
                      <Download className="size-3.5" />
                      <span>
                        Download CSV (
                        {selectedExportCustomerIds.size > 0
                          ? `${selectedExportCustomerIds.size} Selected`
                          : exportScope === "all"
                            ? `${totalCount} Contacts`
                            : exportScope}
                        )
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
