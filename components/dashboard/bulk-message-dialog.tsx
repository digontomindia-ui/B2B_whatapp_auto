"use client";

import type { DashboardCustomer, DashboardGroup } from "./types";
import {
  Users,
  Loader2,
  X,
  AlertTriangle,
  Search,
  Check,
  CheckSquare,
  Building2
} from "lucide-react";
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDisplayPhone } from "@/utils/phone";
import { useAuth } from "@/providers/auth";

interface BulkMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomers: DashboardCustomer[];
  onStarted: () => void;
}

export function BulkMessageDialog({
  isOpen,
  onClose,
  selectedCustomers = [],
  onStarted
}: BulkMessageDialogProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [allowOverride, setAllowOverride] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 3 Recipient selection modes: "ALL" | "CUSTOM" | "GROUPS"
  const [activeTab, setActiveTab] = useState<"ALL" | "CUSTOM" | "GROUPS">(() =>
    selectedCustomers.length > 0 ? "CUSTOM" : "ALL"
  );

  // Custom contact selection state (Tab 2)
  const [search, setSearch] = useState("");
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => {
    return new Set(selectedCustomers.map((c) => c.id));
  });

  // Groups selection state (Tab 3)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set()
  );
  const [groupSearch, setGroupSearch] = useState("");

  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setCheckedIds(new Set(selectedCustomers.map((c) => c.id)));
      if (selectedCustomers.length > 0) {
        setActiveTab("CUSTOM");
      }
      setSearch("");
      setGroupSearch("");
    }
  }

  // Audience stats for "ALL" mode
  const { data: statsData, isLoading: isLoadingStats } = useQuery<{
    total: number;
    active: number;
    blocked: number;
    optedOut: number;
    scopedToStaff: boolean;
    staffName: string | null;
  }>({
    queryKey: ["customers-stats"],
    queryFn: async () => {
      const res = await fetch("/api/customers/stats");
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to load audience stats");
      }
      return json.data;
    },
    enabled: isOpen
  });

  // Groups query for "GROUPS" mode
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery<{
    error: boolean;
    message: string;
    data: DashboardGroup[];
  }>({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups");
      const json = await res.json();
      return json;
    },
    enabled: isOpen
  });

  const groups: DashboardGroup[] = groupsData?.data || [];

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return groups;
    const q = groupSearch.toLowerCase().trim();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, groupSearch]);

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

  const totalAudience = statsData?.total ?? 0;
  const activeAudience = statsData?.active ?? 0;
  const blockedCount = statsData?.blocked ?? 0;
  const optedOutCount = statsData?.optedOut ?? 0;

  const eligibleCount = useMemo(() => {
    if (activeTab === "ALL") {
      return allowOverride ? totalAudience : activeAudience;
    }
    if (activeTab === "GROUPS") {
      return groups
        .filter((g) => selectedGroupIds.has(g.id))
        .reduce((sum, g) => sum + (g._count?.customers || 0), 0);
    }
    if (allowOverride) {
      return checkedCustomers.length;
    }
    return checkedCustomers.filter((c) => c.state === "ACTIVE").length;
  }, [
    activeTab,
    allowOverride,
    totalAudience,
    activeAudience,
    groups,
    selectedGroupIds,
    checkedCustomers
  ]);

  if (!isOpen) return null;

  function toggleContact(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllContacts() {
    setCheckedIds(new Set(selectedCustomers.map((c) => c.id)));
  }

  function deselectAllContacts() {
    setCheckedIds(new Set());
  }

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllGroups() {
    setSelectedGroupIds(new Set(groups.map((g) => g.id)));
  }

  function deselectAllGroups() {
    setSelectedGroupIds(new Set());
  }

  async function handleConfirm() {
    if (eligibleCount === 0) {
      toast.error("No eligible recipients selected");
      return;
    }
    if (activeTab === "CUSTOM" && checkedIds.size === 0) {
      toast.error("Please select at least one recipient");
      return;
    }
    if (activeTab === "GROUPS" && selectedGroupIds.size === 0) {
      toast.error("Please select at least one group");
      return;
    }
    if (!content.trim()) {
      toast.error("Please provide broadcast message content");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bulk/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          targetMode: activeTab,
          customerIds:
            activeTab === "CUSTOM" ? Array.from(checkedIds) : undefined,
          groupIds:
            activeTab === "GROUPS" ? Array.from(selectedGroupIds) : undefined,
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
          {/* Target Mode 3 Tabs */}
          <div className="space-y-2">
            <div className="border-border bg-muted/30 grid grid-cols-3 gap-1 rounded-lg border p-1">
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
                  activeTab === "ALL"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="size-3.5" />
                <span>All Customers</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("CUSTOM")}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
                  activeTab === "CUSTOM"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CheckSquare className="size-3.5" />
                <span>Custom (Specifics)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("GROUPS")}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
                  activeTab === "GROUPS"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="size-3.5" />
                <span>Groups</span>
              </button>
            </div>

            {/* TAB 1: ALL CUSTOMERS */}
            {activeTab === "ALL" && (
              <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-foreground text-xs font-semibold">
                      {statsData?.scopedToStaff
                        ? `Staff Scope: Assigned to ${statsData.staffName || user?.name}`
                        : "Organization Scope: All CRM Contacts"}
                    </h4>
                    <p className="text-muted-foreground text-[11px]">
                      {statsData?.scopedToStaff
                        ? "Only customers explicitly assigned to your staff email will receive this broadcast."
                        : "Admins can broadcast to all permitted contacts in the CRM database."}
                    </p>
                  </div>
                  {isLoadingStats && (
                    <Loader2 className="text-cf-orange size-4 animate-spin" />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="border-border bg-background rounded border p-2">
                    <span className="text-muted-foreground block text-[10px]">
                      Eligible (Active)
                    </span>
                    <strong className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                      {activeAudience}
                    </strong>
                  </div>
                  <div className="border-border bg-background rounded border p-2">
                    <span className="text-muted-foreground block text-[10px]">
                      Blocked
                    </span>
                    <strong className="font-mono text-sm text-red-500">
                      {blockedCount}
                    </strong>
                  </div>
                  <div className="border-border bg-background rounded border p-2">
                    <span className="text-muted-foreground block text-[10px]">
                      Opted Out
                    </span>
                    <strong className="font-mono text-sm text-amber-500">
                      {optedOutCount}
                    </strong>
                  </div>
                </div>

                {(blockedCount > 0 || optedOutCount > 0) && (
                  <div className="border-border flex items-center gap-2 border-t pt-2 text-[11px]">
                    <input
                      type="checkbox"
                      id="msg-override-all"
                      checked={allowOverride}
                      onChange={(e) => setAllowOverride(e.target.checked)}
                      className="accent-cf-orange cursor-pointer rounded"
                    />
                    <label
                      htmlFor="msg-override-all"
                      className="text-muted-foreground cursor-pointer"
                    >
                      Override: Include blocked / opted-out contacts (
                      {totalAudience} total)
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CUSTOM SPECIFICS */}
            {activeTab === "CUSTOM" && (
              <div className="border-border bg-muted/20 space-y-2.5 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-xs font-semibold">
                    Recipients ({checkedIds.size} of {selectedCustomers.length}{" "}
                    selected)
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllContacts}
                      className="text-cf-orange cursor-pointer hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={deselectAllContacts}
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
                      {selectedCustomers.length === 0
                        ? "No contacts pre-selected. Pick contacts from the customer list first."
                        : "No matching contacts found"}
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
                      {
                        checkedCustomers.filter((c) => c.state === "ACTIVE")
                          .length
                      }
                    </strong>
                  </span>
                  <span>
                    Total Selected:{" "}
                    <strong className="text-foreground font-mono">
                      {checkedCustomers.length}
                    </strong>
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: GROUPS */}
            {activeTab === "GROUPS" && (
              <div className="border-border bg-muted/20 space-y-2.5 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-xs font-semibold">
                    Select Groups ({selectedGroupIds.size} of {groups.length}{" "}
                    selected)
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllGroups}
                      className="text-cf-orange cursor-pointer hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={deselectAllGroups}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Search Filter */}
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
                  <input
                    type="text"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Search groups by name..."
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded border py-1 pr-2.5 pl-7 text-xs focus:outline-none"
                  />
                </div>

                {/* Group Checkbox List */}
                <div className="border-border bg-background divide-border/60 max-h-36 divide-y overflow-y-auto rounded border">
                  {isLoadingGroups ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="text-cf-orange size-4 animate-spin" />
                    </div>
                  ) : filteredGroups.length === 0 ? (
                    <div className="text-muted-foreground p-3 text-center text-[11px]">
                      No groups found
                    </div>
                  ) : (
                    filteredGroups.map((grp) => {
                      const isChecked = selectedGroupIds.has(grp.id);
                      return (
                        <div
                          key={grp.id}
                          onClick={() => toggleGroup(grp.id)}
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
                                toggleGroup(grp.id);
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
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: grp.color || "#f6821f"
                              }}
                            />
                            <span className="text-foreground truncate text-xs font-medium">
                              {grp.name}
                            </span>
                          </div>

                          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                            {grp._count?.customers || 0} customers
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="text-muted-foreground flex justify-between pt-1 text-[11px]">
                  <span>
                    Groups Selected:{" "}
                    <strong className="text-foreground font-mono">
                      {selectedGroupIds.size}
                    </strong>
                  </span>
                  <span>
                    Total Customers:{" "}
                    <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                      {eligibleCount}
                    </strong>
                  </span>
                </div>
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
