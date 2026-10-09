"use client";

import type { DashboardBulkJob } from "./types";
import { BarChart3, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import React from "react";

interface BulkJobsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: DashboardBulkJob[];
  isLoading: boolean;
}

export function BulkJobsDialog({
  isOpen,
  onClose,
  jobs,
  isLoading
}: BulkJobsDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 duration-150">
      <div className="border-border bg-card flex max-h-[85vh] w-full max-w-2xl flex-col space-y-4 rounded-lg border p-5 text-xs shadow-2xl">
        {/* Header */}
        <div className="border-border flex flex-shrink-0 items-center justify-between border-b pb-3">
          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="text-cf-orange size-4" />
            <span>Bulk Broadcast Jobs &amp; Delivery Progress</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {isLoading && jobs.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              Loading broadcast jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <BarChart3 className="text-muted-foreground/40 mx-auto mb-2 size-8" />
              <p className="text-foreground font-semibold">
                No bulk jobs executed yet
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Select customers and use &quot;Send Bulk Message&quot; or
                &quot;Send Bulk Template&quot; to begin.
              </p>
            </div>
          ) : (
            jobs.map((job) => {
              const pctSent =
                job.totalRecipients > 0
                  ? Math.round(
                      ((job.sentCount + job.failedCount) /
                        job.totalRecipients) *
                        100
                    )
                  : 0;

              return (
                <div
                  key={job.id}
                  className="border-border bg-muted/20 space-y-2.5 rounded-lg border p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-foreground text-sm font-semibold">
                        {job.title || `Job: ${job.type}`}
                      </span>
                      <div className="text-muted-foreground text-[11px]">
                        Started: {new Date(job.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      {job.status === "RUNNING" && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                          <Loader2 className="size-3 animate-spin" /> RUNNING
                        </span>
                      )}
                      {job.status === "COMPLETED" && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <CheckCircle className="size-3" /> COMPLETED
                        </span>
                      )}
                      {job.status === "PARTIAL" && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          <AlertCircle className="size-3" /> PARTIAL
                        </span>
                      )}
                      {job.status === "FAILED" && (
                        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                          <AlertCircle className="size-3" /> FAILED
                        </span>
                      )}
                      {job.status === "PENDING" && (
                        <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold">
                          QUEUED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="text-muted-foreground flex justify-between text-[11px]">
                      <span>Progress: {pctSent}%</span>
                      <span>
                        {job.sentCount + job.failedCount} /{" "}
                        {job.totalRecipients} dispatched
                      </span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-cf-orange h-full transition-all duration-300"
                        style={{ width: `${pctSent}%` }}
                      />
                    </div>
                  </div>

                  {/* Counters grid */}
                  <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono text-[11px]">
                    <div className="bg-background border-border rounded border p-1.5">
                      <span className="text-muted-foreground block text-[10px]">
                        Sent
                      </span>
                      <span className="text-foreground font-semibold">
                        {job.sentCount}
                      </span>
                    </div>
                    <div className="bg-background border-border rounded border p-1.5">
                      <span className="text-muted-foreground block text-[10px]">
                        Delivered
                      </span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {job.deliveredCount}
                      </span>
                    </div>
                    <div className="bg-background border-border rounded border p-1.5">
                      <span className="text-muted-foreground block text-[10px]">
                        Read
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {job.readCount}
                      </span>
                    </div>
                    <div className="bg-background border-border rounded border p-1.5">
                      <span className="text-muted-foreground block text-[10px]">
                        Failed
                      </span>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {job.failedCount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
