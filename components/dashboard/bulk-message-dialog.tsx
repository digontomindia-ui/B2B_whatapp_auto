"use client";

import type { DashboardCustomer } from "./types";
import { Users, Loader2, X, AlertTriangle, Search, Check } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { formatDisplayPhone } from "@/utils/phone";

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
  const [search, setSearch] = useState("");

  // Manage individual contact selection inside the dialog
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => {
    return new Set(selectedCustomers.map((c) => c.id));
  });

  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setCheckedIds(new Set(selectedCustomers.map((c) => c.id)));
      setSearch("");
    }
  }

  if (!isOpen) return null;

  const filteredCustomers = selectedCustomers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = (c.customName || c.whatsappName || "").toLowerCase();
    const phone = c.normalizedPhone.toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  const checkedCustomers = selectedCustomers.filter((c) =>
    checkedIds.has(c.id)
  );
  const total = checkedCustomers.length;
  const blockedCount = checkedCustomers.filter(
    (c) => c.state === "BLOCKED"
  ).length;
  const optedOutCount = checkedCustomers.filter(
    (c) => c.state === "OPTED_OUT"
  ).length;
  const activeCount = checkedCustomers.filter(
    (c) => c.state === "ACTIVE"
  ).length;
  const eligibleCount = allowOverride ? total : activeCount;

  function toggleContact(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setCheckedIds(new Set(selectedCustomers.map((c) => c.id)));
  }

  function deselectAll() {
    setCheckedIds(new Set());
  }

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
        ? checkedCustomers.map((c) => c.id)
        : checkedCustomers.filter((c) => c.state === "ACTIVE").map((c) => c.id);

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
      const msg =
        err instanceof Error ? err.message : "Failed to start bulk message";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="border-border bg-card flex max-h-[90vh] w-full max-w-lg flex-col space-y-4 rounded-lg border p-5 text-xs shadow-xl">
        {/* Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b pb-3">
          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <Users className="text-cf-orange size-4" />
            <span>Send Bulk Message</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Recipient Selection Panel */}
          <div className="border-border bg-muted/20 space-y-2.5 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-xs font-semibold">
                Recipients ({checkedIds.size} of {selectedCustomers.length}{" "}
                selected)
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-cf-orange cursor-pointer hover:underline"
                >
                  Select All
                </button>
                <span className="text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Recipient Search Filter */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name or phone..."
                className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded border py-1 pr-2.5 pl-7 text-xs focus:outline-none"
              />
            </div>

            {/* Contact Checkbox List */}
            <div className="border-border bg-background divide-border/60 max-h-36 divide-y overflow-y-auto rounded border">
              {filteredCustomers.length === 0 ? (
                <div className="text-muted-foreground p-3 text-center text-[11px]">
                  No matching contacts
                </div>
              ) : (
                filteredCustomers.map((cust) => {
                  const isChecked = checkedIds.has(cust.id);
                  const name =
                    cust.customName ||
                    cust.whatsappName ||
                    formatDisplayPhone(cust.normalizedPhone);

                  return (
                    <div
                      key={cust.id}
                      onClick={() => toggleContact(cust.id)}
                      className={`flex cursor-pointer items-center justify-between px-2.5 py-1.5 transition-colors select-none ${
                        isChecked ? "bg-accent/40" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleContact(cust.id);
                          }}
                          className={`flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${
                            isChecked
                              ? "bg-cf-orange border-cf-orange text-white"
                              : "border-border hover:border-foreground/50 bg-background"
                          }`}
                        >
                          {isChecked && (
                            <Check className="size-2.5 stroke-[3]" />
                          )}
                        </button>
                        <span className="text-foreground truncate text-xs font-medium">
                          {name}
                        </span>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {formatDisplayPhone(cust.normalizedPhone)}
                        </span>
                      </div>

                      {cust.state !== "ACTIVE" && (
                        <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                          {cust.state}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Breakdown Status Info */}
            <div className="text-muted-foreground flex justify-between pt-1 text-[11px]">
              <span>
                Eligible Active:{" "}
                <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                  {activeCount}
                </strong>
              </span>
              {blockedCount > 0 && (
                <span>
                  Blocked:{" "}
                  <strong className="font-mono text-red-500">
                    {blockedCount}
                  </strong>
                </span>
              )}
              {optedOutCount > 0 && (
                <span>
                  Opted out:{" "}
                  <strong className="font-mono text-amber-500">
                    {optedOutCount}
                  </strong>
                </span>
              )}
            </div>

            {(blockedCount > 0 || optedOutCount > 0) && (
              <div className="border-border flex items-center gap-2 border-t pt-2 text-[11px]">
                <input
                  type="checkbox"
                  id="override-checkbox"
                  checked={allowOverride}
                  onChange={(e) => setAllowOverride(e.target.checked)}
                  className="accent-cf-orange cursor-pointer rounded"
                />
                <label
                  htmlFor="override-checkbox"
                  className="text-muted-foreground cursor-pointer"
                >
                  Override: Include blocked / opted-out contacts
                </label>
              </div>
            )}
          </div>

          {/* WhatsApp 24h Window Notice */}
          <div className="bg-muted/40 border-border text-muted-foreground flex gap-2 rounded border p-2.5 text-[11px]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            <p>
              Note: Plain text messages require an active 24-hour WhatsApp
              customer-service window. Meta will reject messages for recipients
              outside the window.
            </p>
          </div>

          {/* Broadcast Message Content */}
          <div className="space-y-1.5">
            <div className="text-foreground flex justify-between font-semibold">
              <label>Message Content</label>
              <span className="text-muted-foreground font-mono text-[11px]">
                {content.length} chars
              </span>
            </div>
            <textarea
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type message to broadcast to selected recipients..."
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full resize-none rounded border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-border flex shrink-0 justify-end gap-2 border-t pt-3">
          <button
            type="button"
            onClick={onClose}
            className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded border px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={eligibleCount === 0 || !content.trim() || isSubmitting}
            className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516] disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Users className="size-3.5" />
            )}
            <span>Send to {eligibleCount} recipients</span>
          </button>
        </div>
      </div>
    </div>
  );
}
