"use client";

import React from "react";
import { BarChart3, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import type { DashboardBulkJob } from "./types";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-2xl space-y-4 text-xs max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3 flex-shrink-0">
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <BarChart3 className="size-4 text-cf-orange" />
            <span>Bulk Broadcast Jobs &amp; Delivery Progress</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading && jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading broadcast jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="mx-auto mb-2 size-8 text-muted-foreground/40" />
              <p className="font-semibold text-foreground">No bulk jobs executed yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Select customers and use &quot;Send Bulk Message&quot; or &quot;Send Bulk Template&quot; to begin.
              </p>
            </div>
          ) : (
            jobs.map((job) => {
              const pctSent =
                job.totalRecipients > 0
                  ? Math.round(
                      ((job.sentCount + job.failedCount) / job.totalRecipients) * 100
                    )
                  : 0;

              return (
                <div
                  key={job.id}
                  className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground text-sm">
                        {job.title || `Job: ${job.type}`}
                      </span>
                      <div className="text-[11px] text-muted-foreground">
                        Started: {new Date(job.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      {job.status === "RUNNING" && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-950/40 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                          <Loader2 className="size-3 animate-spin" /> RUNNING
                        </span>
                      )}
                      {job.status === "COMPLETED" && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle className="size-3" /> COMPLETED
                        </span>
                      )}
                      {job.status === "PARTIAL" && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          <AlertCircle className="size-3" /> PARTIAL
                        </span>
                      )}
                      {job.status === "FAILED" && (
                        <span className="inline-flex items-center gap-1 rounded bg-red-100 dark:bg-red-950/40 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400">
                          <AlertCircle className="size-3" /> FAILED
                        </span>
                      )}
                      {job.status === "PENDING" && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          QUEUED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Progress: {pctSent}%</span>
                      <span>
                        {job.sentCount + job.failedCount} / {job.totalRecipients} dispatched
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-cf-orange transition-all duration-300"
                        style={{ width: `${pctSent}%` }}
                      />
                    </div>
                  </div>

                  {/* Counters grid */}
                  <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono text-[11px]">
                    <div className="rounded bg-background p-1.5 border border-border">
                      <span className="text-muted-foreground block text-[10px]">Sent</span>
                      <span className="font-semibold text-foreground">{job.sentCount}</span>
                    </div>
                    <div className="rounded bg-background p-1.5 border border-border">
                      <span className="text-muted-foreground block text-[10px]">Delivered</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{job.deliveredCount}</span>
                    </div>
                    <div className="rounded bg-background p-1.5 border border-border">
                      <span className="text-muted-foreground block text-[10px]">Read</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{job.readCount}</span>
                    </div>
                    <div className="rounded bg-background p-1.5 border border-border">
                      <span className="text-muted-foreground block text-[10px]">Failed</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">{job.failedCount}</span>
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
