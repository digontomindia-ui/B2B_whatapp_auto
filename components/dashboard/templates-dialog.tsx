"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw,
  Layers,
  X,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";
import type { DashboardTemplate } from "./types";

interface TemplatesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  templates: DashboardTemplate[];
  onSynced: () => void;
}

export function TemplatesDialog({
  isOpen,
  onClose,
  templates,
  onSynced
}: TemplatesDialogProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  async function handleSync() {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/templates/sync", {
        method: "POST"
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to sync templates");
      }
      toast.success(json.message || "Templates synced from Meta");
      onSynced();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      toast.error(msg);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 duration-150">
      <div className="border-border bg-card flex max-h-[85vh] w-full max-w-2xl flex-col space-y-4 rounded-lg border p-5 text-xs shadow-2xl">
        {/* Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b pb-3">
          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <Layers className="text-cf-orange size-4" />
            <span>WhatsApp Business Templates ({templates.length})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#e87516] disabled:opacity-50"
            >
              <RefreshCw
                className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              <span>Sync from Meta</span>
            </button>

            <button
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded p-1"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Templates list */}
        <div className="flex-1 space-y-3 overflow-y-auto pr-10">
          {templates.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <Layers className="text-muted-foreground/40 mx-auto mb-2 size-8" />
              <p className="text-foreground font-semibold">
                No templates found in database
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Click &quot;Sync from Meta&quot; above to import your approved
                message templates.
              </p>
            </div>
          ) : (
            templates.map((tpl) => {
              const bodyComp = tpl.components.find((c) => c.type === "BODY");
              const isApproved = tpl.status === "APPROVED";
              const isPending = tpl.status === "PENDING";

              return (
                <div
                  key={tpl.id}
                  className="border-border bg-muted/20 hover:border-cf-orange/40 max-h-100 space-y-2 overflow-auto rounded-lg border p-3.5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground text-sm font-semibold">
                          {tpl.name}
                        </span>
                        <span className="bg-muted py-0.2 text-muted-foreground border-border rounded border px-1.5 font-mono text-[10px]">
                          {tpl.language.toUpperCase()}
                        </span>
                        <span className="bg-muted py-0.2 text-muted-foreground rounded px-1.5 text-[10px] font-medium">
                          {tpl.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <CheckCircle className="size-3" /> APPROVED
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          <Clock className="size-3" /> PENDING
                        </span>
                      )}
                      {!isApproved && !isPending && (
                        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                          <AlertCircle className="size-3" /> {tpl.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body preview */}
                  {bodyComp?.text && (
                    <div className="bg-background text-foreground border-border rounded border p-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                      {bodyComp.text}
                    </div>
                  )}

                  {/* Rejection reason if any */}
                  {tpl.rejectedReason && (
                    <p className="text-destructive text-[11px] font-medium">
                      Rejection Reason: {tpl.rejectedReason}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
