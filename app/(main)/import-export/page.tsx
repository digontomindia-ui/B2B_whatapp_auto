"use client";

import type { DashboardCustomer } from "@/components/dashboard/types";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  Check,
  CheckSquare,
  Square,
  Database,
  Users,
  Loader2,
  Flame,
  Sun,
  Snowflake,
  Lock,
  ArrowRight,
  ArrowLeft,
  Phone
} from "lucide-react";
import React, { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EXPORTABLE_COLUMNS, type ImportResult } from "@/server/customers/csv";
import Papa from "papaparse";
import { toast } from "sonner";
import { formatDisplayPhone, normalizePhoneNumber } from "@/utils/phone";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";

interface DuplicateEntry {
  rowIndex: number;
  rawPhone: string;
  normalizedPhone: string;
  row: Record<string, string>;
}

interface DuplicatePhoneGroup {
  phone: string;
  displayPhone: string;
  entries: DuplicateEntry[];
}

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
  const [importSubTab, setImportSubTab] = useState<
    "preview" | "resolve_duplicates"
  >("preview");
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
  const [userDuplicateResolutions, setUserDuplicateResolutions] = useState<
    Record<string, number>
  >({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------------------------------------------------
  // EXPORT STATE
  // -------------------------------------------------------------
  const [exportScope, setExportScope] = useState<
    | "selected"
    | "all"
    | "active"
    | "blocked"
    | "opted_out"
    | "hot"
    | "warm"
    | "cold"
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
  // COLUMN MATCHING DETECTION (8 Standard Fields)
  // -------------------------------------------------------------
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

  const nameHeader = findMatchingHeader([
    "name",
    "customname",
    "fullname",
    "contactname",
    "firstname",
    "customername"
  ]);

  const companyHeader = findMatchingHeader([
    "company name",
    "company_name",
    "company",
    "companyname",
    "organization",
    "business",
    "firm"
  ]);

  const addressHeader = findMatchingHeader([
    "address",
    "physical address",
    "physical_address",
    "location",
    "street",
    "city"
  ]);

  const tagsHeader = findMatchingHeader([
    "tag",
    "tags",
    "labels",
    "label",
    "category",
    "categories"
  ]);

  const groupHeader = findMatchingHeader([
    "group",
    "group name",
    "group_name",
    "groups",
    "customer_group",
    "customergroup"
  ]);

  const notesHeader = findMatchingHeader([
    "note",
    "notes",
    "custom note",
    "custom_note",
    "remarks",
    "remark",
    "comment",
    "comments"
  ]);

  const assignToHeader = findMatchingHeader([
    "assign to",
    "assign_to",
    "assigned to",
    "assigned_to",
    "staff email",
    "staff_email",
    "staffemail",
    "staff",
    "agent email",
    "agent_email"
  ]);

  function getRowFieldValue(
    row: Record<string, string>,
    headerMatch: string | null,
    aliases: string[]
  ): string {
    if (
      headerMatch &&
      row[headerMatch] !== undefined &&
      row[headerMatch] !== null
    ) {
      const val = String(row[headerMatch]).trim();
      if (val) return val;
    }
    const keys = Object.keys(row);
    for (const alias of aliases) {
      const target = alias.toLowerCase().replace(/[\s_-]+/g, "");
      const match = keys.find(
        (k) =>
          k
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, "") === target
      );
      if (match && row[match] !== undefined && row[match] !== null) {
        const val = String(row[match]).trim();
        if (val) return val;
      }
    }
    return "";
  }

  // -------------------------------------------------------------
  // DUPLICATE PHONE NUMBER DETECTION
  // -------------------------------------------------------------
  const { duplicateGroups, rowDuplicateMap, totalDuplicateRows } =
    useMemo(() => {
      if (parsedRows.length === 0) {
        return {
          duplicateGroups: [] as DuplicatePhoneGroup[],
          rowDuplicateMap: new Map<
            number,
            { isDuplicate: boolean; count: number; phone: string }
          >(),
          totalDuplicateRows: 0
        };
      }

      const phoneMap = new Map<string, DuplicateEntry[]>();

      parsedRows.forEach((row, idx) => {
        const rawPhone = getRowFieldValue(row, phoneHeader, [
          "ph_no",
          "phno",
          "phone",
          "phonenumber",
          "mobile",
          "contact",
          "whatsapp",
          "number"
        ]);

        if (rawPhone) {
          const norm = normalizePhoneNumber(rawPhone) || rawPhone.trim();
          if (norm) {
            const list = phoneMap.get(norm) || [];
            list.push({
              rowIndex: idx,
              rawPhone,
              normalizedPhone: norm,
              row
            });
            phoneMap.set(norm, list);
          }
        }
      });

      const dupGroups: DuplicatePhoneGroup[] = [];
      const rowDup = new Map<
        number,
        { isDuplicate: boolean; count: number; phone: string }
      >();
      let totalDup = 0;

      phoneMap.forEach((entries, normPhone) => {
        if (entries.length > 1) {
          dupGroups.push({
            phone: normPhone,
            displayPhone: formatDisplayPhone(normPhone),
            entries
          });
          totalDup += entries.length;
          entries.forEach((e) => {
            rowDup.set(e.rowIndex, {
              isDuplicate: true,
              count: entries.length,
              phone: normPhone
            });
          });
        }
      });

      return {
        duplicateGroups: dupGroups,
        rowDuplicateMap: rowDup,
        totalDuplicateRows: totalDup
      };
    }, [parsedRows, phoneHeader]);

  // Purely derive duplicate resolutions from user manual choices or default to first entry
  const duplicateResolutions = useMemo(() => {
    const map: Record<string, number> = {};
    duplicateGroups.forEach((group) => {
      const userChoice = userDuplicateResolutions[group.phone];
      if (
        userChoice !== undefined &&
        group.entries.some((e) => e.rowIndex === userChoice)
      ) {
        map[group.phone] = userChoice;
      } else {
        map[group.phone] = group.entries[0].rowIndex;
      }
    });
    return map;
  }, [duplicateGroups, userDuplicateResolutions]);

  // Set of row indices discarded because another duplicate candidate was accepted
  const duplicateDiscardedIndices = useMemo(() => {
    const discarded = new Set<number>();
    duplicateGroups.forEach((group) => {
      const keptIndex = duplicateResolutions[group.phone];
      group.entries.forEach((entry) => {
        if (entry.rowIndex !== keptIndex) {
          discarded.add(entry.rowIndex);
        }
      });
    });
    return discarded;
  }, [duplicateGroups, duplicateResolutions]);

  // Count of effective unique rows to be imported
  const effectiveImportCount = useMemo(() => {
    let count = 0;
    parsedRows.forEach((_, idx) => {
      if (
        selectedImportRowIndices.has(idx) &&
        !duplicateDiscardedIndices.has(idx)
      ) {
        count++;
      }
    });
    return count;
  }, [parsedRows, selectedImportRowIndices, duplicateDiscardedIndices]);

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
    setImportSubTab("preview");

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

  function resetImportState() {
    setImportFile(null);
    setParsedRows([]);
    setSelectedImportRowIndices(new Set());
    setDetectedHeaders([]);
    setImportResult(null);
    setImportSubTab("preview");
    setUserDuplicateResolutions({});
  }

  function handleAcceptAllFirst() {
    const updated: Record<string, number> = {};
    duplicateGroups.forEach((g) => {
      updated[g.phone] = g.entries[0].rowIndex;
    });
    setUserDuplicateResolutions(updated);
    toast.success("Selected first entry for all duplicate phone numbers");
  }

  function handleAcceptAllLast() {
    const updated: Record<string, number> = {};
    duplicateGroups.forEach((g) => {
      updated[g.phone] = g.entries[g.entries.length - 1].rowIndex;
    });
    setUserDuplicateResolutions(updated);
    toast.success("Selected last entry for all duplicate phone numbers");
  }

  function downloadSampleCsv() {
    const sampleData = [
      {
        ph_no: "+91 90461 13306",
        name: "Aquib Alam",
        "company name": "Mariya Technoindia",
        address: "Salt Lake Sector V, Kolkata",
        tag: "Admission 2026, VIP Parents",
        group: "VIP Parents",
        note: "Met at education fair, requested fee details",
        "assign to": "staff@myschoolbranding.com"
      },
      {
        ph_no: "+91 98765 43210",
        name: "John Doe",
        "company name": "Apex Global School",
        address: "Park Street, Kolkata",
        tag: "Lead, Prospect",
        group: "New Enquiries",
        note: "Follow up regarding admission brochure",
        "assign to": "counselor@myschoolbranding.com"
      },
      {
        ph_no: "+91 88888 77777",
        name: "Priya Sharma",
        "company name": "EduConsult",
        address: "MG Road, Bangalore",
        tag: "Alumni",
        group: "Alumni Network",
        note: "Prefers WhatsApp updates",
        "assign to": ""
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

    const rowsToImport = parsedRows.filter(
      (_, idx) =>
        selectedImportRowIndices.has(idx) && !duplicateDiscardedIndices.has(idx)
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
      setImportSubTab("preview");
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
        filterParams?: { communicationState?: string; status?: string };
        columns: string[];
      } = {
        columns: activeKeys
      };

      if (exportScope === "selected" || selectedExportCustomerIds.size > 0) {
        payload.customerIds = Array.from(selectedExportCustomerIds);
      } else if (
        exportScope === "hot" ||
        exportScope === "warm" ||
        exportScope === "cold"
      ) {
        payload.filterParams = { status: exportScope.toUpperCase() };
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
      <div className="border-border bg-card shrink-0 space-y-3 border-b p-4 shadow-xs">
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          {/* Tabs */}
          <div className="border-border bg-muted/40 flex items-center gap-1.5 rounded-lg border p-1">
            {canImport && (
              <button
                onClick={() => setActiveTab("import")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === "import"
                    ? "bg-background text-cf-orange font-bold shadow-xs"
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
                    ? "bg-background text-cf-orange font-bold shadow-xs"
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
          <div className="mx-auto max-w-5xl space-y-5">
            {/* Post-Import Results Card */}
            {importResult && (
              <div className="bg-card space-y-4 rounded-xl border border-emerald-500/30 p-5 shadow-xs">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                  <div>
                    <h3 className="text-foreground text-sm font-bold">
                      Import Completed Successfully
                    </h3>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Contacts processed with phone number uniqueness
                      validation, group assignment, and duplicate merging.
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
                  onClick={resetImportState}
                  className="bg-cf-orange cursor-pointer rounded-md px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
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
                        Supports: name, ph_no (unique), company name, address,
                        tag, group, note, assign to
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
                        Files must be in UTF-8 .csv format. Phone numbers must
                        be unique.
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
                            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                              {parsedRows.length} rows detected
                            </span>
                            {duplicateGroups.length > 0 && (
                              <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="size-3" />
                                {duplicateGroups.length} duplicate numbers
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-[11px]">
                            {(importFile.size / 1024).toFixed(1)} KB • CSV
                            Format
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={resetImportState}
                        className="border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded border px-2.5 py-1 text-xs"
                      >
                        Change File
                      </button>
                    </div>
                  )}
                </div>

                {/* Subtab Stepper: Data Preview vs Resolve Duplicates */}
                {parsedRows.length > 0 && (
                  <div className="border-border bg-card flex flex-col items-stretch justify-between gap-3 rounded-xl border p-2 shadow-xs sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setImportSubTab("preview")}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                          importSubTab === "preview"
                            ? "bg-cf-orange/10 text-cf-orange border-cf-orange/30 border font-bold"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        <FileSpreadsheet className="size-3.5" />
                        <span>1. File & Data Preview</span>
                        <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">
                          {parsedRows.length} rows
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportSubTab("resolve_duplicates")}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                          importSubTab === "resolve_duplicates"
                            ? "border border-amber-500/40 bg-amber-500/15 font-bold text-amber-600 dark:text-amber-400"
                            : duplicateGroups.length > 0
                              ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        <AlertTriangle className="size-3.5" />
                        <span>2. Resolve Duplicates</span>
                        {duplicateGroups.length > 0 ? (
                          <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            {duplicateGroups.length}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">
                            0
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="text-muted-foreground px-2 text-[11px]">
                      {duplicateGroups.length > 0 ? (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          ⚠️ {totalDuplicateRows} rows share{" "}
                          {duplicateGroups.length} numbers (Must choose 1 each)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                          <Check className="size-3.5" /> All phone numbers in
                          file are unique
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* VIEW 1: DATA PREVIEW & CONFIGURATION */}
                {parsedRows.length > 0 && importSubTab === "preview" && (
                  <>
                    {/* Step 2: Detected Column Mapping (8 User Fields) */}
                    {detectedHeaders.length > 0 && (
                      <div className="border-border bg-card space-y-3 rounded-xl border p-5 shadow-xs">
                        <div className="border-border flex items-center justify-between border-b pb-2">
                          <h3 className="text-foreground text-xs font-bold">
                            Step 2: Detected Field Mapping
                          </h3>
                          <span className="text-muted-foreground font-mono text-[11px]">
                            {detectedHeaders.length} total headers in CSV
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          {/* 1. ph_no */}
                          <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase">
                              Phone (ph_no) *
                            </span>
                            <div className="text-foreground mt-1 flex items-center gap-1 font-mono font-medium">
                              {phoneHeader ? (
                                <>
                                  <Check className="size-3 shrink-0 text-emerald-500" />
                                  <span className="truncate">
                                    {phoneHeader}
                                  </span>
                                </>
                              ) : (
                                <span className="text-destructive flex items-center gap-1 font-semibold">
                                  <AlertCircle className="size-3 shrink-0" />{" "}
                                  Missing!
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 2. name */}
                          <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase">
                              Name (name)
                            </span>
                            <div className="text-foreground mt-1 truncate font-mono">
                              {nameHeader ? (
                                <span className="text-foreground font-medium">
                                  {nameHeader}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  (optional)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 3. company name */}
                          <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase">
                              Company Name
                            </span>
                            <div className="text-foreground mt-1 truncate font-mono">
                              {companyHeader ? (
                                <span className="text-foreground font-medium">
                                  {companyHeader}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  (optional)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 4. address */}
                          <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase">
                              Physical Address
                            </span>
                            <div className="text-foreground mt-1 truncate font-mono">
                              {addressHeader ? (
                                <span className="text-foreground font-medium">
                                  {addressHeader}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  (optional)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 5. tag */}
                          <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase">
                              Tag (comma-separated)
                            </span>
                            <div className="text-foreground mt-1 truncate font-mono">
                              {tagsHeader ? (
                                <span className="text-foreground font-medium">
                                  {tagsHeader}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  (optional)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 6. group */}
                          <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase">
                              Group (case-insensitive)
                            </span>
                            <div className="text-foreground mt-1 truncate font-mono">
                              {groupHeader ? (
                                <span className="text-foreground font-medium">
                                  {groupHeader}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  (optional)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 7. note */}
                          <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase">
                              Custom Note
                            </span>
                            <div className="text-foreground mt-1 truncate font-mono">
                              {notesHeader ? (
                                <span className="text-foreground font-medium">
                                  {notesHeader}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  (optional)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 8. assign to */}
                          <div className="bg-muted/40 border-border/60 rounded border p-2.5">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase">
                              Assign To (Staff Email)
                            </span>
                            <div className="text-foreground mt-1 truncate font-mono">
                              {assignToHeader ? (
                                <span className="text-foreground font-medium">
                                  {assignToHeader}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  (optional)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Import Settings */}
                    <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-xs">
                      <h3 className="text-foreground border-border border-b pb-2 text-xs font-bold">
                        Step 3: Configuration & Duplication Strategy
                      </h3>

                      <div className="space-y-3">
                        <label className="flex cursor-pointer items-start gap-2.5 text-xs">
                          <input
                            type="checkbox"
                            checked={updateExisting}
                            onChange={(e) =>
                              setUpdateExisting(e.target.checked)
                            }
                            className="border-border text-cf-orange focus:ring-cf-orange mt-0.5 cursor-pointer rounded"
                          />
                          <div>
                            <span className="text-foreground font-semibold">
                              Update & merge existing CRM contacts (Recommended)
                            </span>
                            <p className="text-muted-foreground text-[11px]">
                              If phone already exists in CRM, updates name,
                              company, address, note, staff assignment and
                              merges tags.
                            </p>
                          </div>
                        </label>

                        <div>
                          <label className="text-muted-foreground block text-[11px] font-semibold">
                            Attach common tag to all imported contacts
                            (optional)
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

                    {/* Step 4: Data Preview with Row Checkboxes & Duplicate Warning */}
                    <div className="border-border bg-card space-y-3 rounded-xl border p-5 shadow-xs">
                      <div className="border-border text-foreground flex items-center justify-between border-b pb-2 text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span>Step 4: Data Preview & Row Selection</span>
                          <span className="bg-cf-orange/10 text-cf-orange rounded-full px-2 py-0.5 font-mono text-[10px] font-medium">
                            {selectedImportRowIndices.size} of{" "}
                            {parsedRows.length} rows selected
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
                            onClick={() =>
                              setSelectedImportRowIndices(new Set())
                            }
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      {/* Duplicate Warning Banner */}
                      {duplicateGroups.length > 0 && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
                            <div className="flex-1">
                              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                                <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400">
                                  Duplicate Contacts Detected (
                                  {totalDuplicateRows} contacts sharing{" "}
                                  {duplicateGroups.length} phone numbers)
                                </h4>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setImportSubTab("resolve_duplicates")
                                  }
                                  className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300"
                                >
                                  Resolve Duplicates Now{" "}
                                  <ArrowRight className="size-3" />
                                </button>
                              </div>
                              <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80">
                                Phone numbers must be unique. All duplicate
                                contacts are marked with an amber badge below.
                                Click{" "}
                                <strong>
                                  &quot;Next: Resolve Duplicates&quot;
                                </strong>{" "}
                                to choose which contact details to accept for
                                each number.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

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
                              <th className="p-2.5 font-medium">
                                Duplicate Status
                              </th>
                              {detectedHeaders.slice(0, 6).map((h, i) => (
                                <th
                                  key={i}
                                  className="max-w-40 truncate p-2.5 font-medium"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-border/60 divide-y">
                            {parsedRows.map((row, idx) => {
                              const isChecked =
                                selectedImportRowIndices.has(idx);
                              const dupInfo = rowDuplicateMap.get(idx);
                              const isDuplicate = !!dupInfo?.isDuplicate;

                              return (
                                <tr
                                  key={idx}
                                  onClick={() => toggleImportRow(idx)}
                                  className={`cursor-pointer transition-colors ${
                                    isDuplicate
                                      ? "bg-amber-500/5 hover:bg-amber-500/10"
                                      : isChecked
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
                                  <td className="p-2.5">
                                    {isDuplicate ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                        <AlertTriangle className="size-3" />
                                        Duplicate ({dupInfo.count} rows)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                        <Check className="size-3" /> Unique
                                      </span>
                                    )}
                                  </td>
                                  {detectedHeaders.slice(0, 6).map((h, i) => (
                                    <td
                                      key={i}
                                      className="text-foreground max-w-40 truncate p-2.5"
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

                      <div className="border-border flex flex-col items-center justify-between gap-3 border-t pt-3 sm:flex-row">
                        <span className="text-muted-foreground text-center text-xs sm:text-left">
                          {duplicateGroups.length > 0 ? (
                            <>
                              Found <strong>{duplicateGroups.length}</strong>{" "}
                              duplicate numbers among{" "}
                              <strong>{selectedImportRowIndices.size}</strong>{" "}
                              checked rows.
                            </>
                          ) : (
                            <>
                              Ready to import{" "}
                              <strong>{selectedImportRowIndices.size}</strong>{" "}
                              unique checked contacts.
                            </>
                          )}
                        </span>

                        {duplicateGroups.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setImportSubTab("resolve_duplicates")
                            }
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-amber-700"
                          >
                            <span>
                              Next: Resolve Duplicates ({duplicateGroups.length}
                              )
                            </span>
                            <ArrowRight className="size-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={handleExecuteImport}
                            disabled={
                              isImporting ||
                              selectedImportRowIndices.size === 0 ||
                              !phoneHeader
                            }
                            className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
                                  Import {selectedImportRowIndices.size}{" "}
                                  Selected Contacts
                                </span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* VIEW 2: RESOLVE DUPLICATE CONTACTS */}
                {parsedRows.length > 0 &&
                  importSubTab === "resolve_duplicates" && (
                    <div className="space-y-4">
                      {/* Header Card */}
                      <div className="bg-card border-border space-y-3 rounded-xl border p-5 shadow-xs">
                        <div className="border-border flex flex-col justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 shrink-0 rounded-lg bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="size-5" />
                            </div>
                            <div>
                              <h3 className="text-foreground text-sm font-bold">
                                Resolve Duplicate Contacts (
                                {duplicateGroups.length} Conflicting Phone
                                Numbers)
                              </h3>
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                Phone numbers must be unique. Select which
                                contact to accept for each duplicate number
                                below. Unselected duplicates will be excluded.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleAcceptAllFirst}
                              className="border-border bg-muted/40 hover:bg-muted text-foreground cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                            >
                              Keep All First
                            </button>
                            <button
                              type="button"
                              onClick={handleAcceptAllLast}
                              className="border-border bg-muted/40 hover:bg-muted text-foreground cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                            >
                              Keep All Last
                            </button>
                          </div>
                        </div>

                        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-[11px]">
                          <span>
                            Total Duplicate Rows in CSV:{" "}
                            <strong className="text-foreground font-mono">
                              {totalDuplicateRows}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Unique Numbers:{" "}
                            <strong className="text-foreground font-mono">
                              {duplicateGroups.length}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Duplicates to Exclude:{" "}
                            <strong className="font-mono text-amber-600 dark:text-amber-400">
                              {duplicateDiscardedIndices.size}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Duplicate Conflict Groups */}
                      <div className="space-y-4">
                        {duplicateGroups.map((group) => {
                          const keptRowIndex =
                            duplicateResolutions[group.phone];

                          return (
                            <div
                              key={group.phone}
                              className="bg-card border-border space-y-3 rounded-xl border p-4 shadow-xs"
                            >
                              <div className="border-border flex flex-col justify-between gap-2 border-b pb-2.5 sm:flex-row sm:items-center">
                                <div className="flex items-center gap-2.5">
                                  <span className="bg-cf-orange/15 text-cf-orange rounded-md p-1.5">
                                    <Phone className="size-4" />
                                  </span>
                                  <div>
                                    <div className="text-foreground flex items-center gap-2 font-mono text-xs font-bold">
                                      <span>{group.displayPhone}</span>
                                      <span className="text-muted-foreground font-sans text-[10px] font-normal">
                                        ({group.entries.length} duplicate
                                        contacts in file)
                                      </span>
                                    </div>
                                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                                      Select which contact to accept for this
                                      phone number:
                                    </p>
                                  </div>
                                </div>

                                <span className="self-start rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 sm:self-auto dark:text-emerald-400">
                                  1 of {group.entries.length} chosen
                                </span>
                              </div>

                              {/* Candidate Cards Grid */}
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {group.entries.map((entry) => {
                                  const isSelected =
                                    keptRowIndex === entry.rowIndex;
                                  const cName = getRowFieldValue(
                                    entry.row,
                                    nameHeader,
                                    ["name", "customname", "fullname"]
                                  );
                                  const cCompany = getRowFieldValue(
                                    entry.row,
                                    companyHeader,
                                    ["company name", "company_name", "company"]
                                  );
                                  const cAddress = getRowFieldValue(
                                    entry.row,
                                    addressHeader,
                                    ["address", "physical address", "location"]
                                  );
                                  const cTag = getRowFieldValue(
                                    entry.row,
                                    tagsHeader,
                                    ["tag", "tags", "label"]
                                  );
                                  const cGroup = getRowFieldValue(
                                    entry.row,
                                    groupHeader,
                                    ["group", "group name", "groups"]
                                  );
                                  const cNote = getRowFieldValue(
                                    entry.row,
                                    notesHeader,
                                    ["note", "notes", "remarks"]
                                  );
                                  const cAssign = getRowFieldValue(
                                    entry.row,
                                    assignToHeader,
                                    ["assign to", "assign_to", "staff email"]
                                  );

                                  return (
                                    <div
                                      key={entry.rowIndex}
                                      onClick={() => {
                                        setUserDuplicateResolutions((prev) => ({
                                          ...prev,
                                          [group.phone]: entry.rowIndex
                                        }));
                                      }}
                                      className={`cursor-pointer space-y-2.5 rounded-lg border p-3.5 text-xs transition-all ${
                                        isSelected
                                          ? "border-emerald-500 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500/40"
                                          : "border-border/80 bg-muted/10 hover:bg-muted/30 opacity-75 hover:opacity-100"
                                      }`}
                                    >
                                      <div className="border-border/50 flex items-center justify-between border-b pb-2">
                                        <label className="flex cursor-pointer items-center gap-2 font-semibold">
                                          <input
                                            type="radio"
                                            name={`duplicate_${group.phone}`}
                                            checked={isSelected}
                                            onChange={() => {
                                              setUserDuplicateResolutions(
                                                (prev) => ({
                                                  ...prev,
                                                  [group.phone]: entry.rowIndex
                                                })
                                              );
                                            }}
                                            className="cursor-pointer text-emerald-600 focus:ring-emerald-500"
                                          />
                                          <span className="text-foreground">
                                            Row #{entry.rowIndex + 1}
                                          </span>
                                        </label>

                                        {isSelected ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                            <Check className="size-3" /> Accept
                                            This Entry
                                          </span>
                                        ) : (
                                          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]">
                                            Will Exclude
                                          </span>
                                        )}
                                      </div>

                                      {/* Fields list */}
                                      <div className="space-y-1 text-[11px]">
                                        <div className="flex justify-between gap-2">
                                          <span className="text-muted-foreground font-medium">
                                            Name:
                                          </span>
                                          <span className="text-foreground max-w-44 truncate font-medium">
                                            {cName || (
                                              <span className="text-muted-foreground/40 italic">
                                                —
                                              </span>
                                            )}
                                          </span>
                                        </div>

                                        <div className="flex justify-between gap-2">
                                          <span className="text-muted-foreground font-medium">
                                            Company:
                                          </span>
                                          <span className="text-foreground max-w-44 truncate">
                                            {cCompany || (
                                              <span className="text-muted-foreground/40 italic">
                                                —
                                              </span>
                                            )}
                                          </span>
                                        </div>

                                        <div className="flex justify-between gap-2">
                                          <span className="text-muted-foreground font-medium">
                                            Group:
                                          </span>
                                          <span className="text-foreground max-w-44 truncate font-medium">
                                            {cGroup ? (
                                              <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">
                                                {cGroup}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground/40 italic">
                                                —
                                              </span>
                                            )}
                                          </span>
                                        </div>

                                        <div className="flex justify-between gap-2">
                                          <span className="text-muted-foreground font-medium">
                                            Address:
                                          </span>
                                          <span className="text-foreground max-w-44 truncate">
                                            {cAddress || (
                                              <span className="text-muted-foreground/40 italic">
                                                —
                                              </span>
                                            )}
                                          </span>
                                        </div>

                                        <div className="flex justify-between gap-2">
                                          <span className="text-muted-foreground font-medium">
                                            Tag:
                                          </span>
                                          <span className="text-foreground max-w-44 truncate">
                                            {cTag || (
                                              <span className="text-muted-foreground/40 italic">
                                                —
                                              </span>
                                            )}
                                          </span>
                                        </div>

                                        <div className="flex justify-between gap-2">
                                          <span className="text-muted-foreground font-medium">
                                            Note:
                                          </span>
                                          <span className="text-foreground max-w-44 truncate">
                                            {cNote || (
                                              <span className="text-muted-foreground/40 italic">
                                                —
                                              </span>
                                            )}
                                          </span>
                                        </div>

                                        <div className="flex justify-between gap-2">
                                          <span className="text-muted-foreground font-medium">
                                            Assign To:
                                          </span>
                                          <span className="text-foreground max-w-44 truncate">
                                            {cAssign || (
                                              <span className="text-muted-foreground/40 italic">
                                                —
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Bottom Action Footer for Duplicate Resolution */}
                      <div className="bg-card border-border flex flex-col items-center justify-between gap-3 rounded-xl border p-4 shadow-xs sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setImportSubTab("preview")}
                          className="border-border bg-background hover:bg-muted text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors"
                        >
                          <ArrowLeft className="size-3.5" />
                          <span>Back to Preview</span>
                        </button>

                        <div className="flex flex-col items-center gap-3 sm:flex-row">
                          <span className="text-muted-foreground text-center text-xs sm:text-right">
                            Will import{" "}
                            <strong className="text-foreground font-mono">
                              {effectiveImportCount}
                            </strong>{" "}
                            unique contacts ({duplicateDiscardedIndices.size}{" "}
                            duplicate entries excluded)
                          </span>

                          <button
                            onClick={handleExecuteImport}
                            disabled={isImporting || effectiveImportCount === 0}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isImporting ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span>Importing Contacts...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="size-3.5" />
                                <span>
                                  Confirm & Import ({effectiveImportCount}{" "}
                                  Unique Contacts)
                                </span>
                              </>
                            )}
                          </button>
                        </div>
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
          <div className="mx-auto max-w-5xl space-y-6">
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

                  <button
                    type="button"
                    onClick={() => setExportScope("hot")}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-3 transition-colors ${
                      exportScope === "hot"
                        ? "border-rose-500 bg-rose-500/10 font-bold text-rose-600 dark:text-rose-400"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <Flame className="mb-1 size-4 fill-rose-500 text-rose-500" />
                    <span>Hot Leads</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportScope("warm")}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-3 transition-colors ${
                      exportScope === "warm"
                        ? "border-amber-500 bg-amber-500/10 font-bold text-amber-600 dark:text-amber-400"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <Sun className="mb-1 size-4 text-amber-500" />
                    <span>Warm Leads</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportScope("cold")}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-3 transition-colors ${
                      exportScope === "cold"
                        ? "border-sky-500 bg-sky-500/10 font-bold text-sky-600 dark:text-sky-400"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <Snowflake className="mb-1 size-4 text-sky-500" />
                    <span>Cold Leads</span>
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
                              <td className="space-y-1 p-2">
                                <div>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      c.state === "ACTIVE"
                                        ? "bg-emerald-500/10 text-emerald-600"
                                        : c.state === "BLOCKED"
                                          ? "bg-red-500/10 text-red-600"
                                          : "bg-amber-500/10 text-amber-600"
                                    }`}
                                  >
                                    {c.state}
                                  </span>
                                </div>
                                <div>
                                  <span
                                    className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${
                                      c.status === "HOT"
                                        ? "border border-rose-500/25 bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                        : c.status === "WARM"
                                          ? "border border-amber-500/25 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                          : "border border-sky-500/25 bg-sky-500/15 text-sky-600 dark:text-sky-400"
                                    }`}
                                  >
                                    {c.status || "COLD"}
                                  </span>
                                </div>
                              </td>
                              <td className="text-muted-foreground max-w-32 truncate p-2">
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
                  className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:opacity-90 disabled:opacity-50"
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
