"use client";

import type { DistributionStats } from "@/server/customers/distribution";
import {
  Users,
  UserCheck,
  UserX,
  Shuffle,
  Sliders,
  CheckSquare,
  ArrowLeft,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Search,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";

interface CustomerItem {
  id: string;
  customName: string | null;
  whatsappName: string | null;
  normalizedPhone: string;
  assignedStaffId: string | null;
  assignedStaff?: {
    id: string;
    name: string;
    email: string;
  } | null;
  tags?: Array<{ tag: { name: string; color: string } }>;
}

export default function CustomerDistributionPage() {
  const queryClient = useQueryClient();
  const { isOwner, hasPermission } = useAuth();

  const canAssign = isOwner || hasPermission(PERMISSIONS.CUSTOMER_ASSIGN);

  // Mode: "AUTO" | "MANUAL_QUOTA" | "MANUAL_DIRECT"
  const [activeMode, setActiveMode] = useState<
    "AUTO" | "MANUAL_QUOTA" | "MANUAL_DIRECT"
  >("AUTO");

  // Mode A (Auto) states
  const [userSelectedStaffIds, setUserSelectedStaffIds] = useState<
    string[] | null
  >(null);
  const [onlyUnassignedAuto, setOnlyUnassignedAuto] = useState(true);

  // Mode B (Manual Quotas: 100 to this, 500 to that) states
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [onlyUnassignedQuota, setOnlyUnassignedQuota] = useState(true);

  // Mode C (Direct Select) states
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [directTargetStaffId, setDirectTargetStaffId] = useState<string>("");

  // Fetch distribution stats
  const {
    data: stats,
    isLoading: isLoadingStats,
    isFetching: isFetchingStats,
    refetch: refetchStats
  } = useQuery<DistributionStats>({
    queryKey: ["distribution-stats"],
    queryFn: async () => {
      const res = await fetch("/api/customers/distribute");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    enabled: canAssign
  });

  // Fetch customers for Mode C (Direct Select)
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery<{
    error: boolean;
    message: string;
    data: {
      customers: CustomerItem[];
    };
  }>({
    queryKey: ["customers-for-distribution", customerSearch],
    queryFn: async () => {
      const q = encodeURIComponent(customerSearch);
      const res = await fetch(`/api/customers?limit=50&search=${q}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json;
    },
    enabled: canAssign && activeMode === "MANUAL_DIRECT"
  });

  const activeStaffList = useMemo(
    () => (stats?.staffList || []).filter((s) => s.isActive),
    [stats?.staffList]
  );

  const selectedStaffIds = useMemo(() => {
    if (userSelectedStaffIds !== null) {
      return userSelectedStaffIds;
    }
    return activeStaffList.map((s) => s.id);
  }, [userSelectedStaffIds, activeStaffList]);

  // Total quota sum for Mode B
  const totalQuotaEntered = useMemo(() => {
    return Object.values(quotas).reduce((sum, val) => sum + (val || 0), 0);
  }, [quotas]);

  // Distribution Mutation
  const distributeMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/customers/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Distribution failed");
      }
      return json;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Distribution executed successfully!");
      queryClient.invalidateQueries({ queryKey: ["distribution-stats"] });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({
        queryKey: ["customers-for-distribution"]
      });
      setSelectedCustomerIds([]);
      setQuotas({});
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Distribution failed");
    }
  });

  const handleRunAuto = () => {
    if (selectedStaffIds.length === 0) {
      toast.error(
        "Please select at least one staff member to receive contacts"
      );
      return;
    }
    distributeMutation.mutate({
      mode: "AUTO",
      staffIds: selectedStaffIds,
      onlyUnassigned: onlyUnassignedAuto
    });
  };

  const handleRunManualQuota = () => {
    const allocations = Object.entries(quotas)
      .map(([staffId, count]) => ({ staffId, count: Number(count) }))
      .filter((a) => a.count > 0);

    if (allocations.length === 0) {
      toast.error(
        "Please enter a customer count for at least one staff member"
      );
      return;
    }

    distributeMutation.mutate({
      mode: "MANUAL_COUNTS",
      allocations,
      onlyUnassigned: onlyUnassignedQuota
    });
  };

  const handleRunDirectAssignment = () => {
    if (selectedCustomerIds.length === 0) {
      toast.error("Please select at least one customer");
      return;
    }

    distributeMutation.mutate({
      mode: "MANUAL_DIRECT",
      customerIds: selectedCustomerIds,
      staffId: directTargetStaffId ? directTargetStaffId : null
    });
  };

  if (!canAssign) {
    return (
      <div className="bg-background flex h-full flex-col items-center justify-center p-6 text-center select-none">
        <ShieldAlert className="text-muted-foreground mb-3 size-10" />
        <h2 className="text-foreground text-base font-semibold">
          Access Restricted
        </h2>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          You do not have permission to distribute or assign customers. Only
          administrators can manage customer assignments.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col overflow-y-auto p-4 select-none sm:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/staff"
              className="border-border bg-card text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md border transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
                Customer Distribution
              </h1>
              <p className="text-muted-foreground text-xs">
                Assign and balance customer contacts across staff members by
                email
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetchStats()}
              disabled={isFetchingStats}
              className="h-8 cursor-pointer gap-1.5 text-xs"
            >
              <RefreshCw
                className={`size-3.5 ${isFetchingStats ? "animate-spin" : ""}`}
              />
              <span>Refresh Stats</span>
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">
                Total Customers
              </span>
              <Users className="text-muted-foreground size-4" />
            </div>
            <span className="text-foreground mt-2 block font-mono text-2xl font-bold">
              {isLoadingStats ? "..." : (stats?.totalCustomers ?? 0)}
            </span>
          </div>

          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Unassigned Contacts
              </span>
              <UserX className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="mt-2 block font-mono text-2xl font-bold text-amber-600 dark:text-amber-400">
              {isLoadingStats ? "..." : (stats?.unassignedCount ?? 0)}
            </span>
          </div>

          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Assigned Contacts
              </span>
              <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="mt-2 block font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {isLoadingStats ? "..." : (stats?.assignedCount ?? 0)}
            </span>
          </div>

          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">
                Active Staff Members
              </span>
              <Users className="text-cf-orange size-4" />
            </div>
            <span className="text-foreground mt-2 block font-mono text-2xl font-bold">
              {isLoadingStats ? "..." : activeStaffList.length}
            </span>
          </div>
        </div>

        {/* Distribution Controls Container */}
        <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
          {/* Mode Tabs Header */}
          <div className="border-border bg-muted/20 flex border-b">
            <button
              type="button"
              onClick={() => setActiveMode("AUTO")}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                activeMode === "AUTO"
                  ? "border-cf-orange text-cf-orange bg-card"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-transparent"
              }`}
            >
              <Shuffle className="size-3.5" />
              <span>a. Auto Distribution (Least-Loaded)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("MANUAL_QUOTA")}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                activeMode === "MANUAL_QUOTA"
                  ? "border-cf-orange text-cf-orange bg-card"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-transparent"
              }`}
            >
              <Sliders className="size-3.5" />
              <span>b. Manual Quotas (100 to A, 500 to B)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("MANUAL_DIRECT")}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                activeMode === "MANUAL_DIRECT"
                  ? "border-cf-orange text-cf-orange bg-card"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-transparent"
              }`}
            >
              <CheckSquare className="size-3.5" />
              <span>c. Select Specific Customers</span>
            </button>
          </div>

          {/* Mode Tab Contents */}
          <div className="space-y-5 p-5">
            {/* ── MODE A: AUTO (LEAST LOADED) ─────────────────────────── */}
            {activeMode === "AUTO" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-foreground text-sm font-semibold">
                    Automatic Balancing
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Contacts will be distributed one by one to whichever staff
                    member currently has the fewest assigned contacts until all
                    contacts are evenly balanced.
                  </p>
                </div>

                <div className="border-border/80 bg-background/50 flex items-center gap-2 rounded-lg border p-3">
                  <input
                    type="checkbox"
                    id="onlyUnassignedAuto"
                    checked={onlyUnassignedAuto}
                    onChange={(e) => setOnlyUnassignedAuto(e.target.checked)}
                    className="accent-cf-orange size-4 cursor-pointer rounded"
                  />
                  <label
                    htmlFor="onlyUnassignedAuto"
                    className="text-foreground cursor-pointer text-xs font-medium"
                  >
                    Only distribute unassigned contacts (
                    {stats?.unassignedCount ?? 0} available)
                  </label>
                </div>

                {/* Staff Selection Checkboxes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-xs font-medium">
                      Include Staff Members in Distribution:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setUserSelectedStaffIds(
                          activeStaffList.map((s) => s.id)
                        )
                      }
                      className="text-cf-orange cursor-pointer text-[11px] hover:underline"
                    >
                      Select All ({activeStaffList.length})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                    {activeStaffList.map((s) => {
                      const isSelected = selectedStaffIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            if (isSelected) {
                              setUserSelectedStaffIds(
                                selectedStaffIds.filter((id) => id !== s.id)
                              );
                            } else {
                              setUserSelectedStaffIds([
                                ...selectedStaffIds,
                                s.id
                              ]);
                            }
                          }}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all ${
                            isSelected
                              ? "border-cf-orange/50 bg-cf-orange/5 ring-cf-orange/40 ring-1"
                              : "border-border bg-card hover:bg-muted/40"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <span className="text-foreground block truncate text-xs font-semibold">
                              {s.name}
                            </span>
                            <span className="text-muted-foreground block truncate font-mono text-[11px]">
                              {s.email}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[10px] font-medium">
                              {s.assignedCount} contacts
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-border flex items-center justify-between border-t pt-3">
                  <span className="text-muted-foreground text-xs">
                    Selected staff: <strong>{selectedStaffIds.length}</strong>{" "}
                    of {activeStaffList.length}
                  </span>

                  <Button
                    type="button"
                    onClick={handleRunAuto}
                    disabled={
                      distributeMutation.isPending ||
                      selectedStaffIds.length === 0 ||
                      (onlyUnassignedAuto &&
                        (stats?.unassignedCount ?? 0) === 0)
                    }
                    className="bg-cf-orange hover:bg-cf-orange/90 h-8 cursor-pointer gap-1.5 px-4 text-xs font-semibold text-white shadow-xs"
                  >
                    {distributeMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Shuffle className="size-3.5" />
                    )}
                    <span>Run Auto Distribution</span>
                  </Button>
                </div>
              </div>
            )}

            {/* ── MODE B: MANUAL QUOTA (100 to A, 500 to B) ───────────── */}
            {activeMode === "MANUAL_QUOTA" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-foreground text-sm font-semibold">
                    Manual Quota Distribution
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Specify the exact number of contacts to allocate to each
                    staff member (e.g. 100 to Staff A, 500 to Staff B).
                  </p>
                </div>

                <div className="border-border/80 bg-background/50 flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="onlyUnassignedQuota"
                      checked={onlyUnassignedQuota}
                      onChange={(e) => setOnlyUnassignedQuota(e.target.checked)}
                      className="accent-cf-orange size-4 cursor-pointer rounded"
                    />
                    <label
                      htmlFor="onlyUnassignedQuota"
                      className="text-foreground cursor-pointer text-xs font-medium"
                    >
                      Allocate from unassigned contacts (
                      {stats?.unassignedCount ?? 0} available)
                    </label>
                  </div>

                  <div className="font-mono text-xs">
                    Total entered:{" "}
                    <strong
                      className={
                        totalQuotaEntered > (stats?.unassignedCount ?? 0)
                          ? "text-destructive font-bold"
                          : "text-foreground font-bold"
                      }
                    >
                      {totalQuotaEntered}
                    </strong>{" "}
                    / {stats?.unassignedCount ?? 0}
                  </div>
                </div>

                {/* Quota inputs per staff */}
                <div className="border-border overflow-hidden rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 border-border border-b text-left">
                      <tr>
                        <th className="text-muted-foreground px-3.5 py-2.5 font-medium">
                          Staff Member
                        </th>
                        <th className="text-muted-foreground px-3.5 py-2.5 font-medium">
                          Email
                        </th>
                        <th className="text-muted-foreground px-3.5 py-2.5 font-medium">
                          Current Assigned
                        </th>
                        <th className="text-muted-foreground px-3.5 py-2.5 text-right font-medium">
                          Contacts to Allocate
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-border/60 divide-y">
                      {activeStaffList.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/20">
                          <td className="text-foreground px-3.5 py-2.5 font-semibold">
                            {s.name}
                          </td>
                          <td className="text-muted-foreground px-3.5 py-2.5 font-mono">
                            {s.email}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono">
                            {s.assignedCount} contacts
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={quotas[s.id] ?? ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setQuotas({
                                  ...quotas,
                                  [s.id]: isNaN(val) ? 0 : Math.max(0, val)
                                });
                              }}
                              className="ml-auto h-7 w-28 text-right font-mono text-xs"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-border flex items-center justify-between border-t pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuotas({})}
                    className="text-muted-foreground h-8 text-xs"
                  >
                    Clear All Inputs
                  </Button>

                  <Button
                    type="button"
                    onClick={handleRunManualQuota}
                    disabled={
                      distributeMutation.isPending || totalQuotaEntered === 0
                    }
                    className="bg-cf-orange hover:bg-cf-orange/90 h-8 cursor-pointer gap-1.5 px-4 text-xs font-semibold text-white shadow-xs"
                  >
                    {distributeMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    <span>Execute Quota Distribution</span>
                  </Button>
                </div>
              </div>
            )}

            {/* ── MODE C: MANUAL DIRECT SELECTION ─────────────────────── */}
            {activeMode === "MANUAL_DIRECT" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-foreground text-sm font-semibold">
                    Select Customers & Assign Staff
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Search and pick specific contacts to assign to a chosen
                    staff member (or unassign).
                  </p>
                </div>

                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <div className="relative w-full flex-1">
                    <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
                    <Input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search customers by name, phone, tags..."
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      Assign to:
                    </span>
                    <select
                      value={directTargetStaffId}
                      onChange={(e) => setDirectTargetStaffId(e.target.value)}
                      className="border-input bg-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-xs font-medium focus-visible:ring-1 focus-visible:outline-none"
                    >
                      <option value="">(Unassigned / Remove Staff)</option>
                      {activeStaffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.email})
                        </option>
                      ))}
                    </select>

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleRunDirectAssignment}
                      disabled={
                        distributeMutation.isPending ||
                        selectedCustomerIds.length === 0
                      }
                      className="bg-cf-orange hover:bg-cf-orange/90 h-8 shrink-0 cursor-pointer px-3 text-xs text-white"
                    >
                      {distributeMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        `Assign (${selectedCustomerIds.length})`
                      )}
                    </Button>
                  </div>
                </div>

                {/* Customer list table */}
                <div className="border-border overflow-hidden rounded-lg border">
                  {isLoadingCustomers ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="text-cf-orange size-5 animate-spin" />
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 border-border border-b text-left">
                        <tr>
                          <th className="w-8 px-3 py-2">
                            <input
                              type="checkbox"
                              checked={
                                (customersData?.data.customers || []).length >
                                  0 &&
                                selectedCustomerIds.length ===
                                  (customersData?.data.customers || []).length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCustomerIds(
                                    (customersData?.data.customers || []).map(
                                      (c) => c.id
                                    )
                                  );
                                } else {
                                  setSelectedCustomerIds([]);
                                }
                              }}
                              className="accent-cf-orange size-3.5 cursor-pointer rounded"
                            />
                          </th>
                          <th className="text-muted-foreground px-3 py-2.5 font-medium">
                            Customer Name
                          </th>
                          <th className="text-muted-foreground px-3 py-2.5 font-medium">
                            Phone
                          </th>
                          <th className="text-muted-foreground px-3 py-2.5 font-medium">
                            Current Staff
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-border/60 divide-y">
                        {(customersData?.data.customers || []).map((c) => {
                          const isChecked = selectedCustomerIds.includes(c.id);
                          const displayName =
                            c.customName || c.whatsappName || "Unknown Contact";

                          return (
                            <tr
                              key={c.id}
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedCustomerIds(
                                    selectedCustomerIds.filter(
                                      (id) => id !== c.id
                                    )
                                  );
                                } else {
                                  setSelectedCustomerIds([
                                    ...selectedCustomerIds,
                                    c.id
                                  ]);
                                }
                              }}
                              className={`cursor-pointer transition-colors ${
                                isChecked
                                  ? "bg-cf-orange/5"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <td
                                className="px-3 py-2.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedCustomerIds([
                                        ...selectedCustomerIds,
                                        c.id
                                      ]);
                                    } else {
                                      setSelectedCustomerIds(
                                        selectedCustomerIds.filter(
                                          (id) => id !== c.id
                                        )
                                      );
                                    }
                                  }}
                                  className="accent-cf-orange size-3.5 cursor-pointer rounded"
                                />
                              </td>
                              <td className="text-foreground px-3 py-2.5 font-semibold">
                                {displayName}
                              </td>
                              <td className="text-muted-foreground px-3 py-2.5 font-mono">
                                {c.normalizedPhone}
                              </td>
                              <td className="px-3 py-2.5">
                                {c.assignedStaff ? (
                                  <span className="bg-muted text-foreground inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px]">
                                    <UserCheck className="size-3 text-emerald-500" />
                                    {c.assignedStaff.name} (
                                    {c.assignedStaff.email})
                                  </span>
                                ) : (
                                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                    Unassigned
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Workload Summary Table */}
        <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-foreground text-sm font-semibold">
                Staff Workload Distribution
              </h2>
              <p className="text-muted-foreground text-xs">
                Overview of contacts assigned per team member
              </p>
            </div>
            <Link
              href="/staff"
              className="text-cf-orange inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              Manage Staff Accounts <ExternalLink className="size-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {activeStaffList.map((s) => {
              const total = stats?.totalCustomers || 1;
              const percent = Math.round((s.assignedCount / total) * 100);

              return (
                <div
                  key={s.id}
                  className="border-border/80 bg-background/50 space-y-2 rounded-lg border p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/staff/${s.id}`}
                          className="text-foreground hover:text-cf-orange inline-flex items-center gap-1 text-xs font-semibold transition-colors"
                        >
                          {s.name} <ExternalLink className="size-2.5" />
                        </Link>
                        <span className="bg-muted py-0.2 text-muted-foreground rounded px-1.5 text-[10px] font-medium">
                          {s.roleName}
                        </span>
                      </div>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {s.email}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-foreground font-mono text-xs font-bold">
                        {s.assignedCount} contacts
                      </span>
                      <span className="text-muted-foreground block font-mono text-[10px]">
                        {percent}% of total
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-cf-orange h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(2, percent))}%`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
