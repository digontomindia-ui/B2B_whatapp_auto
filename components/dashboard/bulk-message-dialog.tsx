"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Users, Loader2, X, AlertTriangle } from "lucide-react";
import type { DashboardCustomer } from "./types";

interface BulkMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomers: DashboardCustomer[];
  onStarted: () => void;
}

export function BulkMessageDialog({
  isOpen,
  onClose,
  selectedCustomers,
  onStarted
}: BulkMessageDialogProps) {
  const [content, setContent] = useState("");
  const [allowOverride, setAllowOverride] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const total = selectedCustomers.length;
  const blockedCount = selectedCustomers.filter((c) => c.state === "BLOCKED").length;
  const optedOutCount = selectedCustomers.filter((c) => c.state === "OPTED_OUT").length;
  const activeCount = selectedCustomers.filter((c) => c.state === "ACTIVE").length;

  const eligibleCount = allowOverride ? total : activeCount;

  async function handleConfirm() {
    if (eligibleCount === 0) {
      toast.error("No eligible recipients selected");
      return;
    }
    if (!content.trim()) {
      toast.error("Please provide broadcast message content");
      return;
    }

    setIsSubmitting(true);
    try {
      const recipientIds = allowOverride
        ? selectedCustomers.map((c) => c.id)
        : selectedCustomers.filter((c) => c.state === "ACTIVE").map((c) => c.id);

      const res = await fetch("/api/bulk/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          customerIds: recipientIds,
          allowOverrideBlocked: allowOverride
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to initiate broadcast");
      }

      toast.success(`Bulk broadcast initiated for ${eligibleCount} customers!`);
      onStarted();
      onClose();
      setContent("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start bulk message";
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
            <Users className="size-4 text-cf-orange" />
            <span>Send Bulk Message</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Recipients Breakdown Card */}
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
          <div className="flex justify-between font-semibold text-foreground">
            <span>Selected Recipients:</span>
            <span>{total} customers</span>
          </div>
          <div className="flex justify-between text-muted-foreground text-[11px]">
            <span>Active &amp; Eligible:</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </span>
          </div>
          {blockedCount > 0 && (
            <div className="flex justify-between text-muted-foreground text-[11px]">
              <span>Blocked (auto-excluded):</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                {blockedCount}
              </span>
            </div>
          )}
          {optedOutCount > 0 && (
            <div className="flex justify-between text-muted-foreground text-[11px]">
              <span>Opted Out (auto-excluded):</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {optedOutCount}
              </span>
            </div>
          )}

          {(blockedCount > 0 || optedOutCount > 0) && (
            <div className="pt-2 border-t border-border/80 flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                id="override-checkbox"
                checked={allowOverride}
                onChange={(e) => setAllowOverride(e.target.checked)}
                className="rounded accent-cf-orange cursor-pointer"
              />
              <label htmlFor="override-checkbox" className="text-muted-foreground cursor-pointer">
                Admin override: Send to blocked / opted-out contacts anyway
              </label>
            </div>
          )}
        </div>

        {/* Notice for 24h window */}
        <div className="rounded bg-amber-50 dark:bg-amber-950/30 p-2.5 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-[11px] flex gap-2">
          <AlertTriangle className="size-4 flex-shrink-0 mt-0.5 text-amber-600" />
          <p>
            Note: WhatsApp requires an active 24-hour service window for plain text messages. Any recipients whose customer window is closed will be rejected by Meta and marked as FAILED with the Meta reason.
          </p>
        </div>

        {/* Message Input */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-semibold text-foreground">
            <label>Broadcast Text Message</label>
            <span className="text-[11px] text-muted-foreground font-mono">
              {content.length} chars
            </span>
          </div>
          <textarea
            rows={5}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type the message to send to all eligible recipients..."
            className="w-full resize-none rounded border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange"
          />
        </div>

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
            disabled={eligibleCount === 0 || !content.trim() || isSubmitting}
            className="inline-flex items-center gap-1.5 rounded bg-cf-orange px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516] cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Users className="size-3.5" />
            )}
            <span>Send to {eligibleCount} customers</span>
          </button>
        </div>
      </div>
    </div>
  );
}
