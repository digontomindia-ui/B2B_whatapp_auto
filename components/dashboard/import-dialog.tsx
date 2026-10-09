"use client";

import type { ImportResult } from "@/server/customers/csv";
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Eye,
  Settings2,
  Check
} from "lucide-react";
import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { toast } from "sonner";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  function resetState() {
    setFile(null);
    setParsedRows([]);
    setSelectedRowIndices(new Set());
    setDetectedHeaders([]);
    setResult(null);
    setDefaultTag("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
        setDetectedHeaders(headers);
        setParsedRows(results.data);
        // Default select all parsed rows
        setSelectedRowIndices(new Set(results.data.map((_, i) => i)));
      },
      error: (err) => {
        toast.error("Error reading CSV file: " + err.message);
      }
    });
  }

  function downloadSampleCsv() {
    const sampleData = [
      {
        phone: "+91 90461 13306",
        name: "Aquib Alam",
        tags: "Admission 2026, VIP",
        notes: "Met at education fair, requested fee details",
        state: "ACTIVE",
        staff_email: "staff@myschoolbranding.com"
      },
      {
        phone: "+91 98765 43210",
        name: "John Doe",
        tags: "Lead",
        notes: "Follow up next Monday",
        state: "ACTIVE",
        staff_email: "counselor@myschoolbranding.com"
      },
      {
        phone: "+91 88888 77777",
        name: "Priya Sharma",
        tags: "Alumni",
        notes: "Prefers email notifications",
        state: "OPTED_OUT",
        staff_email: ""
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

  async function handleExecuteImport() {
    const rowsToImport = parsedRows.filter((_, idx) =>
      selectedRowIndices.has(idx)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="border-border bg-card animate-in fade-in-50 zoom-in-95 relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl">
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
                Upload contacts to your WhatsApp CRM with automatic phone
                normalization
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
                    Your contacts have been processed and are now available in
                    your WhatsApp inbox.
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
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                  <div className="text-[10px] font-medium text-emerald-600 uppercase dark:text-emerald-400">
                    Created
                  </div>
                  <div className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {result.createdCount}
                  </div>
                </div>
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-center">
                  <div className="text-[10px] font-medium text-blue-600 uppercase dark:text-blue-400">
                    Updated
                  </div>
                  <div className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">
                    {result.updatedCount}
                  </div>
                </div>
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-center">
                  <div className="text-[10px] font-medium text-red-600 uppercase dark:text-red-400">
                    Errors
                  </div>
                  <div className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">
                    {result.errorCount}
                  </div>
                </div>
              </div>

              {/* Error details if any */}
              {result.errors.length > 0 && (
                <div className="border-destructive/30 bg-destructive/5 space-y-2 rounded-lg border p-3">
                  <div className="text-destructive flex items-center gap-1.5 text-xs font-semibold">
                    <AlertCircle className="size-3.5" />
                    <span>Failed Rows ({result.errors.length})</span>
                  </div>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto text-[11px]">
                    {result.errors.map((err, i) => (
                      <div
                        key={i}
                        className="bg-card/80 border-border flex items-center justify-between rounded border p-1.5"
                      >
                        <span className="text-muted-foreground font-mono">
                          Row {err.row}:
                        </span>
                        <span className="text-foreground font-mono">
                          {err.phone || "(no phone)"}
                        </span>
                        <span className="text-destructive max-w-50 truncate">
                          {err.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* File Upload Box */}
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
                    Click to select a CSV file or drag and drop
                  </p>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    Supports columns for Phone, Name, Tags, Notes, and Status
                  </p>
                </div>
              ) : (
                /* Selected File Card */
                <div className="border-border bg-muted/30 flex items-center justify-between rounded-lg border p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="bg-cf-orange/15 text-cf-orange rounded p-2">
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
                  Need formatting guidance? Download our ready-to-use template:
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

              {/* Detected Columns Mapping Breakdown */}
              {detectedHeaders.length > 0 && (
                <div className="border-border bg-card space-y-2.5 rounded-lg border p-3.5">
                  <div className="text-foreground border-border flex items-center justify-between border-b pb-1.5 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Eye className="text-cf-orange size-3.5" />
                      Detected Columns Mapping
                    </span>
                    <span className="text-muted-foreground text-[10px] font-normal">
                      {detectedHeaders.length} total headers found
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground text-[10px] font-semibold uppercase">
                        Phone (Required)
                      </div>
                      <div className="text-foreground mt-0.5 flex items-center gap-1 font-mono font-medium">
                        {phoneHeader ? (
                          <>
                            <Check className="size-3 text-emerald-500" />
                            <span>{phoneHeader}</span>
                          </>
                        ) : (
                          <span className="flex items-center gap-1 font-semibold text-red-500">
                            <AlertCircle className="size-3" /> Missing!
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground text-[10px] font-semibold uppercase">
                        Custom Name
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

                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground text-[10px] font-semibold uppercase">
                        Tags
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

                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground text-[10px] font-semibold uppercase">
                        Notes
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

                    <div className="bg-muted/40 border-border/60 rounded border p-2">
                      <div className="text-muted-foreground text-[10px] font-semibold uppercase">
                        Status / State
                      </div>
                      <div className="text-foreground mt-0.5 truncate font-mono">
                        {stateHeader ? (
                          <span className="text-foreground">{stateHeader}</span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            Defaults to ACTIVE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Import Options */}
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
                          If a phone number already exists, update name, append
                          new tags, and add notes instead of skipping.
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
                        placeholder="e.g. October Batch 2026, Education Fair"
                        className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Preview of rows with Checkboxes */}
              {parsedRows.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-foreground flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span>Data Preview & Row Selection</span>
                      <span className="bg-cf-orange/10 text-cf-orange rounded-full px-2 py-0.5 font-mono text-[10px] font-medium">
                        {selectedRowIndices.size} of {parsedRows.length}{" "}
                        selected
                      </span>
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
                          return (
                            <tr
                              key={idx}
                              onClick={() => toggleRowSelection(idx)}
                              className={`cursor-pointer transition-colors ${
                                isChecked
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
