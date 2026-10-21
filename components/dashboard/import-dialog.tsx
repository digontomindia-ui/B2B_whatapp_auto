"use client";

import type { ImportResult } from "@/server/customers/csv";
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Eye,
  Settings2,
  Check,
  ArrowRight,
  ArrowLeft,
  Users,
  Briefcase,
  MapPin,
  Tag,
  Building2,
  FileText,
  Mail,
  Phone,
  UserCheck
} from "lucide-react";
import React, { useState, useRef, useMemo } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { formatDisplayPhone, normalizePhoneNumber } from "@/utils/phone";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Map row column headers flexibly
function getFieldValue(row: Record<string, string>, aliases: string[]): string {
  if (!row) return "";
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
  return "";
}

export function ImportDialog({
  isOpen,
  onClose,
  onSuccess
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Array<Record<string, string>>>(
    []
  );
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(
    new Set()
  );
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [defaultTag, setDefaultTag] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Tabs: "review" | "duplicates"
  const [activeTab, setActiveTab] = useState<"review" | "duplicates">("review");

  // Selection for duplicate conflicts: phone -> row index OR "skip"
  const [duplicateSelections, setDuplicateSelections] = useState<
    Record<string, number | "skip">
  >({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function resetState() {
    setFile(null);
    setParsedRows([]);
    setSelectedRowIndices(new Set());
    setDetectedHeaders([]);
    setResult(null);
    setDefaultTag("");
    setActiveTab("review");
    setDuplicateSelections({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Row field helpers
  function getRowPhone(row: Record<string, string>) {
    return getFieldValue(row, [
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
  }

  function getRowName(row: Record<string, string>) {
    return getFieldValue(row, [
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
  }

  function getRowCompany(row: Record<string, string>) {
    return getFieldValue(row, [
      "company name",
      "company_name",
      "company",
      "companyname",
      "organization",
      "business",
      "firm"
    ]);
  }

  function getRowAddress(row: Record<string, string>) {
    return getFieldValue(row, [
      "address",
      "physical address",
      "physical_address",
      "location",
      "street",
      "city"
    ]);
  }

  function getRowTag(row: Record<string, string>) {
    return getFieldValue(row, ["tag", "tags", "labels", "label"]);
  }

  function getRowGroup(row: Record<string, string>) {
    return getFieldValue(row, [
      "group",
      "group name",
      "group_name",
      "groupname",
      "school",
      "school name",
      "school_name",
      "schoolname",
      "customer group",
      "customer_group"
    ]);
  }

  function getRowNote(row: Record<string, string>) {
    return getFieldValue(row, [
      "note",
      "notes",
      "custom note",
      "custom_note",
      "remarks",
      "remark",
      "comment",
      "comments"
    ]);
  }

  function getRowAssignTo(row: Record<string, string>) {
    return getFieldValue(row, [
      "assign to",
      "assign_to",
      "assigned to",
      "assigned_to",
      "staff email",
      "staff_email",
      "staffemail",
      "staff_mail",
      "staff",
      "agent email",
      "agent_email",
      "agent",
      "owner_email"
    ]);
  }

  // Detect duplicates across parsedRows
  const { phoneToIndicesMap, duplicateGroups, duplicateRowIndexSet } =
    useMemo(() => {
      const map = new Map<string, number[]>();
      const dupRowSet = new Set<number>();

      parsedRows.forEach((row, idx) => {
        const rawPhone = getRowPhone(row);
        const normalized = normalizePhoneNumber(rawPhone) || rawPhone.trim();
        if (normalized) {
          const list = map.get(normalized) || [];
          list.push(idx);
          map.set(normalized, list);
        }
      });

      const groups: Array<{ phone: string; indices: number[] }> = [];
      for (const [phone, indices] of map.entries()) {
        if (indices.length > 1) {
          groups.push({ phone, indices });
          indices.forEach((i) => dupRowSet.add(i));
        }
      }

      return {
        phoneToIndicesMap: map,
        duplicateGroups: groups,
        duplicateRowIndexSet: dupRowSet
      };
    }, [parsedRows]);

  function handleFileChange(selectedFile: File) {
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a valid .csv file");
      return;
    }

    setFile(selectedFile);
    setResult(null);

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

        const headers = results.meta.fields || [];
        const rows = results.data;
        setDetectedHeaders(headers);
        setParsedRows(rows);
        setSelectedRowIndices(new Set(rows.map((_, i) => i)));

        // Compute duplicates on load and pre-select first row for each group
        const map = new Map<string, number[]>();
        rows.forEach((row, idx) => {
          const raw = getRowPhone(row);
          const norm = normalizePhoneNumber(raw) || raw.trim();
          if (norm) {
            const list = map.get(norm) || [];
            list.push(idx);
            map.set(norm, list);
          }
        });

        const initialSelections: Record<string, number | "skip"> = {};
        for (const [phone, indices] of map.entries()) {
          if (indices.length > 1) {
            initialSelections[phone] = indices[0];
          }
        }
        setDuplicateSelections(initialSelections);
        setActiveTab("review");
      },
      error: (err) => {
        toast.error("Error reading CSV file: " + err.message);
      }
    });
  }

  function downloadSampleCsv() {
    const sampleData = [
      {
        name: "Aquib Alam",
        ph_no: "+91 90461 13306",
        "company name": "Delhi Public School",
        address: "Sector 12, RK Puram, New Delhi 110022",
        tag: "Admission 2026, VIP",
        group: "DPS Delhi",
        note: "Met at education fair, requested fee details",
        "assign to": "staff@myschoolbranding.com"
      },
      {
        name: "John Doe",
        ph_no: "+91 98765 43210",
        "company name": "Apex Learning Academy",
        address: "45 Park Street, Kolkata 700016",
        tag: "Lead, Inquirer",
        group: "Modern School",
        note: "Follow up next Monday regarding prospectus",
        "assign to": "counselor@myschoolbranding.com"
      },
      {
        name: "Priya Sharma",
        ph_no: "+91 88888 77777",
        "company name": "Sunrise International",
        address: "MG Road, Bangalore 560001",
        tag: "Alumni",
        group: "DPS Delhi",
        note: "Prefers WhatsApp announcements",
        "assign to": "staff@myschoolbranding.com"
      }
    ];

    const csvContent = Papa.unparse(sampleData, { header: true });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "customer_contacts_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Sample template downloaded");
  }

  function toggleRowSelection(idx: number) {
    setSelectedRowIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  function toggleSelectAllRows() {
    if (selectedRowIndices.size === parsedRows.length) {
      setSelectedRowIndices(new Set());
    } else {
      setSelectedRowIndices(new Set(parsedRows.map((_, i) => i)));
    }
  }

  // Build final unique rows to import
  function buildFinalRowsToImport(): Array<Record<string, string>> {
    // 1. Unique rows that are NOT in any duplicate group and are checked
    const nonDuplicateRows = Array.from(selectedRowIndices)
      .filter((idx) => !duplicateRowIndexSet.has(idx))
      .map((idx) => parsedRows[idx]);

    // 2. The chosen winning contact for each duplicate group
    const acceptedDuplicateRows: Array<Record<string, string>> = [];
    duplicateGroups.forEach((g) => {
      const choice = duplicateSelections[g.phone];
      if (typeof choice === "number" && selectedRowIndices.has(choice)) {
        acceptedDuplicateRows.push(parsedRows[choice]);
      }
    });

    return [...nonDuplicateRows, ...acceptedDuplicateRows];
  }

  async function handleExecuteImport() {
    const finalRows = buildFinalRowsToImport();

    if (finalRows.length === 0) {
      toast.error("Please select at least one contact row to import");
      return;
    }

    setIsImporting(true);

    try {
      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: finalRows,
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

      setResult(json.data);
      toast.success(json.message);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  }

  // Detect which headers matched key fields
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
    "phone",
    "phonenumber",
    "mobile",
    "contact",
    "number",
    "whatsapp"
  ]);
  const nameHeader = findMatchingHeader([
    "name",
    "customer name",
    "customname",
    "fullname",
    "contactname",
    "firstname"
  ]);
  const companyHeader = findMatchingHeader([
    "company name",
    "company_name",
    "company",
    "organization",
    "business"
  ]);
  const addressHeader = findMatchingHeader([
    "address",
    "physical address",
    "location",
    "street"
  ]);
  const tagsHeader = findMatchingHeader(["tag", "tags", "labels", "label"]);
  const groupHeader = findMatchingHeader([
    "group",
    "group name",
    "group_name",
    "school",
    "customer group"
  ]);
  const notesHeader = findMatchingHeader([
    "note",
    "notes",
    "custom note",
    "remarks",
    "comment"
  ]);
  const assignToHeader = findMatchingHeader([
    "assign to",
    "assign_to",
    "assigned to",
    "staff email",
    "staff_email",
    "staff"
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="border-border bg-card animate-in fade-in-50 zoom-in-95 relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="border-border bg-muted/20 flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-cf-orange/10 text-cf-orange border-cf-orange/20 rounded-lg border p-2">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h2 className="text-foreground text-sm font-semibold">
                Import Contacts from CSV
              </h2>
              <p className="text-muted-foreground text-[11px]">
                Import customer contacts with strict phone uniqueness and
                duplicate resolution
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-md p-1.5"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Navigation if file is parsed and duplicates exist */}
        {file && !result && duplicateGroups.length > 0 && (
          <div className="border-border bg-muted/40 flex border-b px-5">
            <button
              type="button"
              onClick={() => setActiveTab("review")}
              className={`flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === "review"
                  ? "border-cf-orange text-cf-orange font-bold"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              }`}
            >
              <span>1. Review Contacts</span>
              <span className="bg-muted text-foreground rounded-full px-2 py-0.5 text-[10px]">
                {parsedRows.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("duplicates")}
              className={`flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === "duplicates"
                  ? "border-amber-500 font-bold text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              }`}
            >
              <AlertTriangle className="size-3.5 text-amber-500" />
              <span>2. Resolve Duplicates</span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {duplicateGroups.length}
              </span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Result View */}
          {result ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                <div>
                  <h3 className="text-foreground text-xs font-semibold">
                    Import Completed Successfully
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    Your contacts have been processed and deduplicated into your
                    CRM.
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="border-border bg-background rounded-lg border p-3 text-center">
                  <div className="text-muted-foreground text-[10px] font-medium uppercase">
                    Total Processed
                  </div>
                  <div className="text-foreground mt-1 text-xl font-bold">
                    {result.totalRows}
                  </div>
                </div>

                <div className="border-border bg-background rounded-lg border p-3 text-center">
                  <div className="text-[10px] font-medium text-emerald-600 uppercase dark:text-emerald-400">
                    New Created
                  </div>
                  <div className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {result.createdCount}
                  </div>
                </div>

                <div className="border-border bg-background rounded-lg border p-3 text-center">
                  <div className="text-cf-orange text-[10px] font-medium uppercase">
                    Updated Existing
                  </div>
                  <div className="text-cf-orange mt-1 text-xl font-bold">
                    {result.updatedCount}
                  </div>
                </div>

                <div className="border-border bg-background rounded-lg border p-3 text-center">
                  <div className="text-[10px] font-medium text-rose-500 uppercase">
                    Errors / Skipped
                  </div>
                  <div className="mt-1 text-xl font-bold text-rose-500">
                    {result.errorCount + result.skippedCount}
                  </div>
                </div>
              </div>

              {/* Error Breakdown if any */}
              {result.errors.length > 0 && (
                <div className="border-border space-y-2 rounded-lg border p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-500">
                    <AlertCircle className="size-4" />
                    <span>Error Log ({result.errors.length} rows failed)</span>
                  </div>
                  <div className="border-border bg-muted/30 max-h-40 divide-y overflow-y-auto rounded border text-[11px]">
                    {result.errors.map((err, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2"
                      >
                        <span className="font-mono text-xs font-semibold">
                          Row #{err.row} {err.phone && `(${err.phone})`}
                        </span>
                        <span className="text-rose-500">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "duplicates" && duplicateGroups.length > 0 ? (
            /* TAB 2: RESOLVE DUPLICATE CONTACTS */
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  <div>
                    <h4 className="text-foreground text-xs font-semibold">
                      Resolve Duplicate Phone Numbers ({duplicateGroups.length}{" "}
                      Conflict Groups)
                    </h4>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      Each customer must have a unique phone number. Please
                      choose which contact record to keep and import for each
                      phone number below:
                    </p>
                  </div>
                </div>

                {/* Quick actions bar */}
                <div className="mt-2.5 flex items-center gap-2 border-t border-amber-500/20 pt-2 text-[11px]">
                  <span className="text-muted-foreground text-[10px]">
                    Quick select:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated: Record<string, number | "skip"> = {};
                      duplicateGroups.forEach((g) => {
                        updated[g.phone] = g.indices[0];
                      });
                      setDuplicateSelections(updated);
                      toast.success(
                        "First contact selected for all duplicate numbers"
                      );
                    }}
                    className="border-border bg-background text-foreground hover:bg-muted cursor-pointer rounded border px-2 py-0.5 font-medium"
                  >
                    Keep First Row for All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated: Record<string, number | "skip"> = {};
                      duplicateGroups.forEach((g) => {
                        updated[g.phone] = g.indices[g.indices.length - 1];
                      });
                      setDuplicateSelections(updated);
                      toast.success(
                        "Last contact selected for all duplicate numbers"
                      );
                    }}
                    className="border-border bg-background text-foreground hover:bg-muted cursor-pointer rounded border px-2 py-0.5 font-medium"
                  >
                    Keep Last Row for All
                  </button>
                </div>
              </div>

              {/* Duplicate Groups Cards List */}
              <div className="space-y-4">
                {duplicateGroups.map((group, groupIdx) => {
                  const selectedIdx = duplicateSelections[group.phone];
                  return (
                    <div
                      key={group.phone}
                      className="border-border bg-card overflow-hidden rounded-lg border shadow-xs"
                    >
                      {/* Group Header */}
                      <div className="border-border bg-muted/30 flex items-center justify-between border-b px-3.5 py-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            #{groupIdx + 1}
                          </span>
                          <span className="text-foreground font-mono text-xs font-semibold">
                            Phone: {formatDisplayPhone(group.phone)}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-[10px]">
                          {group.indices.length} duplicate rows found in CSV
                        </span>
                      </div>

                      {/* Candidate Contact Rows */}
                      <div className="divide-border/60 divide-y p-1">
                        {group.indices.map((rowIdx) => {
                          const rowData = parsedRows[rowIdx];
                          const isChosen = selectedIdx === rowIdx;
                          const name =
                            getRowName(rowData) || "No name provided";
                          const company = getRowCompany(rowData);
                          const address = getRowAddress(rowData);
                          const groupName = getRowGroup(rowData);
                          const tagVal = getRowTag(rowData);
                          const noteVal = getRowNote(rowData);
                          const assignToVal = getRowAssignTo(rowData);

                          return (
                            <div
                              key={rowIdx}
                              onClick={() => {
                                setDuplicateSelections((prev) => ({
                                  ...prev,
                                  [group.phone]: rowIdx
                                }));
                              }}
                              className={`flex cursor-pointer items-start gap-3 rounded p-2.5 transition-colors select-none ${
                                isChosen
                                  ? "bg-cf-orange/10 border-cf-orange/30 border"
                                  : "hover:bg-muted/40"
                              }`}
                            >
                              {/* Radio Button */}
                              <input
                                type="radio"
                                name={`dup-group-${group.phone}`}
                                checked={isChosen}
                                onChange={() => {
                                  setDuplicateSelections((prev) => ({
                                    ...prev,
                                    [group.phone]: rowIdx
                                  }));
                                }}
                                className="accent-cf-orange mt-1 cursor-pointer"
                              />

                              {/* Candidate Info */}
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-foreground text-xs font-semibold">
                                      {name}
                                    </span>
                                    <span className="border-border bg-muted/60 text-muted-foreground py-0.2 rounded border px-1.5 font-mono text-[9px]">
                                      CSV Row #{rowIdx + 1}
                                    </span>
                                  </div>
                                  {isChosen && (
                                    <span className="bg-cf-orange/20 text-cf-orange rounded px-2 py-0.5 text-[10px] font-bold">
                                      ✓ Selected to Import
                                    </span>
                                  )}
                                </div>

                                <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
                                  {company && (
                                    <div className="flex items-center gap-1">
                                      <Briefcase className="text-cf-orange size-3 shrink-0" />
                                      <span className="text-foreground truncate">
                                        {company}
                                      </span>
                                    </div>
                                  )}
                                  {groupName && (
                                    <div className="flex items-center gap-1">
                                      <Building2 className="text-cf-orange size-3 shrink-0" />
                                      <span className="text-foreground truncate">
                                        {groupName}
                                      </span>
                                    </div>
                                  )}
                                  {assignToVal && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="text-cf-orange size-3 shrink-0" />
                                      <span className="text-foreground truncate">
                                        {assignToVal}
                                      </span>
                                    </div>
                                  )}
                                  {tagVal && (
                                    <div className="flex items-center gap-1">
                                      <Tag className="text-cf-orange size-3 shrink-0" />
                                      <span className="text-foreground truncate">
                                        {tagVal}
                                      </span>
                                    </div>
                                  )}
                                  {address && (
                                    <div className="col-span-2 flex items-center gap-1">
                                      <MapPin className="text-cf-orange size-3 shrink-0" />
                                      <span className="text-foreground truncate">
                                        {address}
                                      </span>
                                    </div>
                                  )}
                                  {noteVal && (
                                    <div className="col-span-2 flex items-center gap-1">
                                      <FileText className="text-cf-orange size-3 shrink-0" />
                                      <span className="text-foreground truncate italic">
                                        Note: {noteVal}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Option to skip this phone number altogether */}
                        <div
                          onClick={() => {
                            setDuplicateSelections((prev) => ({
                              ...prev,
                              [group.phone]: "skip"
                            }));
                          }}
                          className={`text-muted-foreground flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs transition-colors select-none ${
                            selectedIdx === "skip"
                              ? "bg-red-500/10 font-semibold text-red-600 dark:text-red-400"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`dup-group-${group.phone}`}
                            checked={selectedIdx === "skip"}
                            onChange={() => {
                              setDuplicateSelections((prev) => ({
                                ...prev,
                                [group.phone]: "skip"
                              }));
                            }}
                            className="cursor-pointer accent-red-500"
                          />
                          <span>
                            Skip this phone number entirely (do not import
                            either contact)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* TAB 1: REVIEW CONTACTS AND UPLOAD */
            <>
              {/* File Upload Dropzone */}
              {!file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) {
                      handleFileChange(e.dataTransfer.files[0]);
                    }
                  }}
                  className="border-border hover:border-cf-orange bg-muted/10 hover:bg-cf-orange/5 group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="bg-cf-orange/10 text-cf-orange rounded-full p-3.5 transition-transform group-hover:scale-110">
                    <Upload className="size-6" />
                  </div>
                  <h3 className="text-foreground mt-3 text-xs font-semibold">
                    Click to select or drag and drop your CSV file
                  </h3>
                  <p className="text-muted-foreground mt-1 max-w-sm text-[11px]">
                    Supported columns: <strong>name</strong>,{" "}
                    <strong>ph_no</strong>, <strong>company name</strong>,{" "}
                    <strong>address</strong>, <strong>tag</strong>,{" "}
                    <strong>group</strong>, <strong>note</strong>,{" "}
                    <strong>assign to</strong>.
                  </p>
                </div>
              ) : (
                <div className="border-border bg-card flex items-center justify-between rounded-lg border p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="bg-cf-orange/10 text-cf-orange rounded-md p-2">
                      <FileSpreadsheet className="size-5" />
                    </div>
                    <div>
                      <div className="text-foreground flex items-center gap-2 text-xs font-semibold">
                        <span>{file.name}</span>
                        <span className="bg-muted py-0.2 text-muted-foreground rounded px-1.5 font-mono text-[10px]">
                          {parsedRows.length} rows detected
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-[11px]">
                        {(file.size / 1024).toFixed(1)} KB • CSV Format
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={resetState}
                    className="border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[11px]"
                  >
                    <RefreshCw className="size-3" />
                    <span>Change File</span>
                  </button>
                </div>
              )}

              {/* Sample Template Link */}
              <div className="bg-muted/20 border-border/60 flex items-center justify-between rounded-lg border p-2.5 text-xs">
                <span className="text-muted-foreground text-[11px]">
                  Need formatting guidance? Download our sample CSV template
                  with all 8 fields:
                </span>
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="text-cf-orange inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium hover:underline"
                >
                  <Download className="size-3" />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              {/* Duplicate Banner Alert if duplicates detected */}
              {parsedRows.length > 0 && duplicateGroups.length > 0 && (
                <div className="flex items-start justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <div>
                      <span className="text-foreground font-semibold">
                        {duplicateGroups.length} duplicate phone number groups
                        detected ({duplicateRowIndexSet.size} contacts affected)
                      </span>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        Phone numbers must be unique. Duplicate rows are
                        highlighted in the table below. When ready, click
                        &quot;Next: Resolve Duplicates&quot; to choose which
                        contact to accept.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("duplicates")}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-amber-600"
                  >
                    <span>Resolve</span>
                    <ArrowRight className="size-3" />
                  </button>
                </div>
              )}

              {/* Detected Columns Mapping Breakdown for all 8 requested fields */}
              {detectedHeaders.length > 0 && (
                <div className="border-border bg-card space-y-2.5 rounded-lg border p-3.5">
                  <div className="text-foreground border-border flex items-center justify-between border-b pb-1.5 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Eye className="text-cf-orange size-3.5" />
                      Detected Columns Mapping ({detectedHeaders.length} headers
                      found)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                    {/* ph_no */}
                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                        <Phone className="text-cf-orange size-3" />
                        ph_no (Required)
                      </div>
                      <div className="text-foreground mt-0.5 flex items-center gap-1 truncate font-mono font-medium">
                        {phoneHeader ? (
                          <>
                            <Check className="size-3 shrink-0 text-emerald-500" />
                            <span className="truncate">{phoneHeader}</span>
                          </>
                        ) : (
                          <span className="flex items-center gap-1 font-semibold text-red-500">
                            <AlertCircle className="size-3 shrink-0" /> Missing!
                          </span>
                        )}
                      </div>
                    </div>

                    {/* name */}
                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                        <UserCheck className="text-cf-orange size-3" />
                        name
                      </div>
                      <div className="text-foreground mt-0.5 truncate font-mono">
                        {nameHeader ? (
                          <span className="text-foreground">{nameHeader}</span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            (optional)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* company name */}
                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                        <Briefcase className="text-cf-orange size-3" />
                        company name
                      </div>
                      <div className="text-foreground mt-0.5 truncate font-mono">
                        {companyHeader ? (
                          <span className="text-foreground">
                            {companyHeader}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            (optional)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* address */}
                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                        <MapPin className="text-cf-orange size-3" />
                        address
                      </div>
                      <div className="text-foreground mt-0.5 truncate font-mono">
                        {addressHeader ? (
                          <span className="text-foreground">
                            {addressHeader}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            (optional)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* tag */}
                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                        <Tag className="text-cf-orange size-3" />
                        tag (commas)
                      </div>
                      <div className="text-foreground mt-0.5 truncate font-mono">
                        {tagsHeader ? (
                          <span className="text-foreground">{tagsHeader}</span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            (optional)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* group */}
                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                        <Building2 className="text-cf-orange size-3" />
                        group
                      </div>
                      <div className="text-foreground mt-0.5 truncate font-mono">
                        {groupHeader ? (
                          <span className="text-foreground">{groupHeader}</span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            (optional)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* note */}
                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                        <FileText className="text-cf-orange size-3" />
                        note
                      </div>
                      <div className="text-foreground mt-0.5 truncate font-mono">
                        {notesHeader ? (
                          <span className="text-foreground">{notesHeader}</span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            (optional)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* assign to */}
                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                        <Mail className="text-cf-orange size-3" />
                        assign to
                      </div>
                      <div className="text-foreground mt-0.5 truncate font-mono">
                        {assignToHeader ? (
                          <span className="text-foreground">
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

              {/* Import Settings */}
              {parsedRows.length > 0 && (
                <div className="border-border bg-card space-y-3 rounded-lg border p-3.5">
                  <div className="text-foreground border-border flex items-center gap-1.5 border-b pb-1.5 text-xs font-semibold">
                    <Settings2 className="text-cf-orange size-3.5" />
                    <span>Import Settings</span>
                  </div>

                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-start gap-2.5 text-xs">
                      <input
                        type="checkbox"
                        checked={updateExisting}
                        onChange={(e) => setUpdateExisting(e.target.checked)}
                        className="border-border text-cf-orange focus:ring-cf-orange mt-0.5 rounded"
                      />
                      <div>
                        <span className="text-foreground font-medium">
                          Update existing contacts (Recommended)
                        </span>
                        <p className="text-muted-foreground text-[11px]">
                          If a customer already exists in the CRM, update
                          details, company, address, append new tags, and notes
                          instead of skipping.
                        </p>
                      </div>
                    </label>

                    <div className="pt-1">
                      <label className="text-muted-foreground block text-[11px] font-medium">
                        Apply common tag to all imported contacts (optional)
                      </label>
                      <input
                        type="text"
                        value={defaultTag}
                        onChange={(e) => setDefaultTag(e.target.value)}
                        placeholder="e.g. October 2026 Batch, Education Fair"
                        className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Data Preview Table with Duplicate Indicators */}
              {parsedRows.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-foreground flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span>Data Preview & Selection</span>
                      <span className="bg-cf-orange/10 text-cf-orange rounded-full px-2 py-0.5 font-mono text-[10px] font-medium">
                        {selectedRowIndices.size} of {parsedRows.length}{" "}
                        selected
                      </span>
                      {duplicateGroups.length > 0 && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          {duplicateRowIndexSet.size} duplicate entries
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedRowIndices(
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
                        onClick={() => setSelectedRowIndices(new Set())}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="border-border max-h-56 overflow-x-auto rounded-lg border">
                    <table className="w-full border-collapse text-left text-[11px]">
                      <thead className="bg-muted/60 text-muted-foreground border-border sticky top-0 border-b">
                        <tr>
                          <th className="w-8 p-2 text-center">
                            <input
                              type="checkbox"
                              checked={
                                selectedRowIndices.size === parsedRows.length &&
                                parsedRows.length > 0
                              }
                              onChange={toggleSelectAllRows}
                              className="border-border text-cf-orange focus:ring-cf-orange cursor-pointer rounded"
                              title="Toggle select all"
                            />
                          </th>
                          <th className="p-2 font-medium">#</th>
                          <th className="p-2 font-medium">Status / Conflict</th>
                          {detectedHeaders.slice(0, 5).map((h, i) => (
                            <th
                              key={i}
                              className="max-w-37.5 truncate p-2 font-medium"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-border/60 divide-y">
                        {parsedRows.map((row, idx) => {
                          const isChecked = selectedRowIndices.has(idx);
                          const isDuplicate = duplicateRowIndexSet.has(idx);
                          const rawPhone = getRowPhone(row);
                          const normPhone =
                            normalizePhoneNumber(rawPhone) || rawPhone.trim();
                          const dupGroupCount =
                            phoneToIndicesMap.get(normPhone)?.length || 1;

                          return (
                            <tr
                              key={idx}
                              onClick={() => toggleRowSelection(idx)}
                              className={`cursor-pointer transition-colors ${
                                isDuplicate
                                  ? isChecked
                                    ? "border-l-2 border-l-amber-500 bg-amber-500/10 hover:bg-amber-500/15"
                                    : "border-l-2 border-l-amber-500 bg-amber-500/5 opacity-50"
                                  : isChecked
                                    ? "bg-cf-orange/5 hover:bg-cf-orange/10"
                                    : "hover:bg-muted/20 opacity-50"
                              }`}
                            >
                              <td
                                className="p-2 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleRowSelection(idx)}
                                  className="border-border text-cf-orange focus:ring-cf-orange cursor-pointer rounded"
                                />
                              </td>
                              <td className="text-muted-foreground p-2 font-mono">
                                {idx + 1}
                              </td>
                              <td className="p-2">
                                {isDuplicate ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="size-2.5" />
                                    <span>
                                      Duplicate ({dupGroupCount} rows)
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">
                                    Unique
                                  </span>
                                )}
                              </td>
                              {detectedHeaders.slice(0, 5).map((h, i) => (
                                <td
                                  key={i}
                                  className="text-foreground max-w-37.5 truncate p-2"
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
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-border bg-muted/20 flex items-center justify-between border-t px-5 py-3.5">
          {result ? (
            <button
              onClick={() => {
                resetState();
                onClose();
              }}
              className="bg-cf-orange ml-auto cursor-pointer rounded-md px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516]"
            >
              Done & Close
            </button>
          ) : activeTab === "duplicates" ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("review")}
                className="border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back to Review</span>
              </button>

              <button
                type="button"
                disabled={isImporting}
                onClick={handleExecuteImport}
                className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#e87516] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Importing Deduplicated Contacts...</span>
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    <span>
                      Confirm & Import ({buildFinalRowsToImport().length}{" "}
                      Contacts)
                    </span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  resetState();
                  onClose();
                }}
                className="border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Cancel
              </button>

              {duplicateGroups.length > 0 ? (
                <button
                  type="button"
                  disabled={
                    !file || selectedRowIndices.size === 0 || !phoneHeader
                  }
                  onClick={() => setActiveTab("duplicates")}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    Next: Resolve Duplicates ({duplicateGroups.length})
                  </span>
                  <ArrowRight className="size-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    !file ||
                    selectedRowIndices.size === 0 ||
                    isImporting ||
                    !phoneHeader
                  }
                  onClick={handleExecuteImport}
                  className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#e87516] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Importing ({selectedRowIndices.size} rows)...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5" />
                      <span>
                        Import{" "}
                        {selectedRowIndices.size > 0
                          ? `${selectedRowIndices.size} Selected`
                          : "Contacts"}
                      </span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
