"use client";

import type {
  DashboardBulkJob,
  DashboardCustomer,
  DashboardTemplate
} from "@/components/dashboard/types";
import {
  Radio,
  Send,
  Layers,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { BulkMessageDialog } from "@/components/dashboard/bulk-message-dialog";
import { BulkTemplateDialog } from "@/components/dashboard/bulk-template-dialog";
import { formatDisplayPhone } from "@/utils/phone";
import { useRealtime } from "@/hooks/use-realtime";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";

export default function BroadcastPage() {
  const queryClient = useQueryClient();
  const { hasPermission, hasAnyPermission, isOwner } = useAuth();

  const canViewJobs = isOwner || hasPermission(PERMISSIONS.BULK_JOB_VIEW);
  const canBroadcastText =
    isOwner || hasPermission(PERMISSIONS.BULK_MESSAGE_SEND);
  const canBroadcastTemplate =
    isOwner ||
    hasAnyPermission([
      PERMISSIONS.BULK_UTILITY_SEND,
      PERMISSIONS.BULK_MARKETING_SEND
    ]);

  useRealtime();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isBulkMessageOpen, setIsBulkMessageOpen] = useState(false);
  const [isBulkTemplateOpen, setIsBulkTemplateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // 1. Fetch bulk jobs
  const {
    data: jobsData,
    isLoading: isLoadingJobs,
    isFetching
  } = useQuery<
    { jobs: DashboardBulkJob[]; pagination: unknown } | DashboardBulkJob[]
  >({
    queryKey: ["bulk-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/bulk/jobs");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    enabled: canViewJobs,
    refetchInterval: 3000 // Poll progress every 3s
  });

  const jobs: DashboardBulkJob[] = useMemo(() => {
    if (!jobsData) return [];
    if (Array.isArray(jobsData)) return jobsData;
    if (Array.isArray((jobsData as { jobs?: DashboardBulkJob[] }).jobs)) {
      return (jobsData as { jobs: DashboardBulkJob[] }).jobs;
    }
    return [];
  }, [jobsData]);

  // 2. Fetch customers for the broadcast modal recipient list
  const { data: customersData } = useQuery<{ customers: DashboardCustomer[] }>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers?limit=100");
      const json = await res.json();
      if (!res.ok || json.error) return { customers: [] };
      return json.data;
    }
  });

  const customers = customersData?.customers || [];

  // 3. Fetch templates for template broadcast
  const { data: templates = [] } = useQuery<DashboardTemplate[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      const json = await res.json();
      if (!res.ok || json.error) return [];
      return json.data;
    }
  });

  // 4. Fetch details for selected job
  const { data: selectedJobDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["bulk-job-details", selectedJobId],
    queryFn: async () => {
      if (!selectedJobId) return null;
      const res = await fetch(`/api/bulk/jobs/${selectedJobId}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    enabled: !!selectedJobId,
    refetchInterval: 2000
  });

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesName = (job.title || job.content || "")
          .toLowerCase()
          .includes(q);
        if (!matchesName) return false;
      }
      if (statusFilter !== "all" && job.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [jobs, search, statusFilter]);

  // Overall stats
  const stats = useMemo(() => {
    const total = jobs.length;
    const running = jobs.filter((j) => j.status === "RUNNING").length;
    const completed = jobs.filter((j) => j.status === "COMPLETED").length;
    const failed = jobs.filter(
      (j) => j.status === "FAILED" || j.status === "PARTIAL"
    ).length;
    const totalRecipients = jobs.reduce((acc, j) => acc + j.totalRecipients, 0);
    const totalSent = jobs.reduce((acc, j) => acc + j.sentCount, 0);
    return { total, running, completed, failed, totalRecipients, totalSent };
  }, [jobs]);

  if (!canViewJobs) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="bg-destructive/10 text-destructive mb-3 rounded-full p-3">
          <Lock className="size-6" />
        </div>
        <h2 className="text-foreground text-base font-semibold">
          Access Restricted
        </h2>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          You do not have permission to view broadcast jobs. Contact your
          administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden">
      {/* Top Header Bar */}
      <div className="border-border bg-card shrink-0 space-y-3 border-b p-4 shadow-2xs">
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          {/* Search & Status Filter */}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative max-w-xs min-w-44 flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search broadcast name..."
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded-md border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-cf-orange cursor-pointer rounded-md border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
            >
              <option value="all">Status: All</option>
              <option value="RUNNING">Running</option>
              <option value="COMPLETED">Completed</option>
              <option value="PARTIALLY_FAILED">Partially Failed</option>
              <option value="FAILED">Failed</option>
            </select>

            <button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["bulk-jobs"] })
              }
              className="border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-md border p-1.5"
              title="Refresh Jobs"
            >
              <RefreshCw
                className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {canBroadcastText && (
              <button
                onClick={() => setIsBulkMessageOpen(true)}
                className="border-border bg-background text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold shadow-2xs transition-colors"
              >
                <Send className="text-cf-orange size-3.5" />
                <span>Broadcast Text</span>
              </button>
            )}

            {canBroadcastTemplate && (
              <button
                onClick={() => setIsBulkTemplateOpen(true)}
                className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#e87516]"
              >
                <Layers className="size-3.5" />
                <span>Broadcast Template</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Strip */}
        <div className="border-border/60 grid grid-cols-2 gap-2.5 border-t pt-1 sm:grid-cols-4">
          <div className="bg-muted/40 border-border/60 flex items-center justify-between rounded-md border p-2">
            <span className="text-muted-foreground text-[11px]">
              Total Broadcasts
            </span>
            <span className="text-foreground text-xs font-bold">
              {stats.total}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-blue-500/20 bg-blue-500/10 p-2">
            <span className="text-[11px] text-blue-600 dark:text-blue-400">
              Running Jobs
            </span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {stats.running}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
              Completed
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {stats.completed}
            </span>
          </div>
          <div className="bg-cf-orange/10 border-cf-orange/20 flex items-center justify-between rounded-md border p-2">
            <span className="text-cf-orange text-[11px]">
              Messages Delivered
            </span>
            <span className="text-cf-orange font-mono text-xs font-bold">
              {stats.totalSent}/{stats.totalRecipients}
            </span>
          </div>
        </div>
      </div>

      {/* Main Broadcast Content (List + Details) */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Left/Main Column: Jobs List */}
        <div
          className={`bg-muted/10 flex-1 space-y-3 overflow-y-auto p-4 ${selectedJobId ? "border-border hidden border-r md:block md:w-1/2 md:flex-none" : "w-full"}`}
        >
          {isLoadingJobs ? (
            <div className="text-muted-foreground flex h-64 items-center justify-center gap-2 text-xs">
              <Loader2 className="text-cf-orange size-4 animate-spin" />
              <span>Loading broadcast jobs...</span>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="border-border bg-card flex h-64 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
              <div className="bg-cf-orange/10 text-cf-orange mb-3 rounded-full p-3">
                <Radio className="size-6" />
              </div>
              <p className="text-foreground text-sm font-semibold">
                No broadcast campaigns yet
              </p>
              <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                Broadcast campaigns allow sending messages or WhatsApp approved
                templates to multiple contacts simultaneously.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => setIsBulkMessageOpen(true)}
                  className="border-border bg-background text-foreground hover:bg-muted cursor-pointer rounded-md border px-3 py-1.5 text-xs font-semibold"
                >
                  Send Text
                </button>
                <button
                  onClick={() => setIsBulkTemplateOpen(true)}
                  className="bg-cf-orange cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516]"
                >
                  Send Template
                </button>
              </div>
            </div>
          ) : (
            filteredJobs.map((job) => {
              const progressPct =
                job.totalRecipients > 0
                  ? Math.round(
                      ((job.sentCount + job.failedCount) /
                        job.totalRecipients) *
                        100
                    )
                  : 0;

              const isSelected = selectedJobId === job.id;

              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    isSelected
                      ? "border-cf-orange bg-card ring-cf-orange/50 shadow-md ring-1"
                      : "border-border bg-card hover:border-border/80 hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground truncate text-xs font-bold">
                          {job.title || job.content || "Bulk Campaign"}
                        </span>
                        <span className="bg-muted py-0.2 text-muted-foreground rounded px-1.5 font-mono text-[10px] uppercase">
                          {job.type}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-[10px]">
                        Created {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {job.status === "COMPLETED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" /> Completed
                        </span>
                      ) : job.status === "RUNNING" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                          <Loader2 className="size-3 animate-spin" /> In
                          Progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          <AlertCircle className="size-3" /> {job.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-muted-foreground">
                        Progress: {progressPct}%
                      </span>
                      <span className="text-foreground">
                        {job.sentCount} sent • {job.failedCount} failed /{" "}
                        {job.totalRecipients} total
                      </span>
                    </div>

                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className={`h-full transition-all duration-300 ${
                          job.status === "COMPLETED"
                            ? "bg-emerald-500"
                            : job.status === "FAILED"
                              ? "bg-destructive"
                              : "bg-cf-orange"
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Job Recipient Breakdown */}
        {selectedJobId && (
          <div className="bg-background border-border flex-1 overflow-y-auto border-t p-4 sm:p-5 md:border-t-0">
            {isLoadingDetails ? (
              <div className="text-muted-foreground flex h-64 items-center justify-center gap-2 text-xs">
                <Loader2 className="text-cf-orange size-4 animate-spin" />
                <span>Loading recipient log...</span>
              </div>
            ) : selectedJobDetails ? (
              <div className="space-y-4">
                {/* Header of details */}
                <div className="border-border flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-foreground text-sm font-bold">
                      {selectedJobDetails.title ||
                        selectedJobDetails.content ||
                        "Broadcast Job Details"}
                    </h3>
                    <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                      ID: {selectedJobDetails.id}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedJobId(null)}
                    className="border-border text-muted-foreground hover:bg-muted rounded border px-2 py-1 text-xs md:hidden"
                  >
                    Back to List
                  </button>
                </div>

                {/* Recipient list table */}
                <div className="space-y-2">
                  <div className="text-foreground flex items-center justify-between text-xs font-semibold">
                    <span>
                      Recipients Log (
                      {selectedJobDetails.recipients?.length || 0})
                    </span>
                  </div>

                  <div className="border-border max-h-96 overflow-x-auto rounded-lg border">
                    <table className="w-full border-collapse text-left text-[11px]">
                      <thead className="bg-muted/60 text-muted-foreground border-border border-b">
                        <tr>
                          <th className="p-2 font-medium">Recipient</th>
                          <th className="p-2 font-medium">Status</th>
                          <th className="p-2 font-medium">Delivered / Read</th>
                          <th className="p-2 font-medium">Error Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-border/60 divide-y">
                        {selectedJobDetails.recipients?.map(
                          (
                            rec: {
                              customer?: {
                                normalizedPhone?: string;
                                phoneNumber?: string;
                                customName?: string | null;
                              };
                              status?: string;
                              deliveredAt?: string | null;
                              readAt?: string | null;
                              errorMessage?: string | null;
                            },
                            idx: number
                          ) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="text-foreground p-2 font-mono">
                                {formatDisplayPhone(
                                  rec.customer?.normalizedPhone ||
                                    rec.customer?.phoneNumber ||
                                    "—"
                                )}
                                {rec.customer?.customName && (
                                  <span className="text-muted-foreground block font-sans text-[10px]">
                                    {rec.customer.customName}
                                  </span>
                                )}
                              </td>
                              <td className="p-2">
                                <span
                                  className={`py-0.2 inline-flex rounded-full px-2 text-[10px] font-semibold ${
                                    rec.status === "READ"
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : rec.status === "DELIVERED"
                                        ? "bg-blue-500/10 text-blue-600"
                                        : rec.status === "SENT"
                                          ? "bg-muted text-foreground"
                                          : "bg-red-500/10 text-red-600"
                                  }`}
                                >
                                  {rec.status}
                                </span>
                              </td>
                              <td className="text-muted-foreground p-2 font-mono text-[10px]">
                                {rec.readAt
                                  ? new Date(rec.readAt).toLocaleTimeString()
                                  : rec.deliveredAt
                                    ? new Date(
                                        rec.deliveredAt
                                      ).toLocaleTimeString()
                                    : "—"}
                              </td>
                              <td className="text-destructive max-w-xs truncate p-2 text-[10px]">
                                {rec.errorMessage || "—"}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <BulkMessageDialog
        isOpen={isBulkMessageOpen}
        onClose={() => setIsBulkMessageOpen(false)}
        selectedCustomers={customers}
        onStarted={() => {
          queryClient.invalidateQueries({ queryKey: ["bulk-jobs"] });
          setIsBulkMessageOpen(false);
        }}
      />

      <BulkTemplateDialog
        isOpen={isBulkTemplateOpen}
        onClose={() => setIsBulkTemplateOpen(false)}
        selectedCustomers={customers}
        templates={templates}
        onStarted={() => {
          queryClient.invalidateQueries({ queryKey: ["bulk-jobs"] });
          setIsBulkTemplateOpen(false);
        }}
      />
    </div>
  );
}
