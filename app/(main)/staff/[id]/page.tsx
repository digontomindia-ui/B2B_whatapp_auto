"use client";

import {
  ArrowLeft,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  MessageSquare,
  ArrowRightLeft,
  UserMinus,
  Loader2,
  AlertCircle,
  X,
  Sliders,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import React, { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";

interface StaffDetailData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  roleId: string;
  role: {
    id: string;
    name: string;
    permissions: number[];
  };
  _count: {
    assignedCustomers: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface AssignedCustomer {
  id: string;
  customName: string | null;
  whatsappName: string | null;
  normalizedPhone: string;
  state: string;
  lastInteractionAt: string | null;
  tags?: Array<{ tag: { name: string; color: string } }>;
}

export default function StaffDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { isOwner, hasPermission } = useAuth();

  const canViewStaff = isOwner || hasPermission(PERMISSIONS.STAFF_VIEW);
  const canAssign = isOwner || hasPermission(PERMISSIONS.CUSTOMER_ASSIGN);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [targetStaffId, setTargetStaffId] = useState<string>("");

  // 1. Fetch Staff Member Details
  const {
    data: staff,
    isLoading: isLoadingStaff,
    isError: isStaffError
  } = useQuery<StaffDetailData>({
    queryKey: ["staff-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/staff/${id}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    enabled: canViewStaff
  });

  // 2. Fetch Assigned Customers List
  const { data: customersResponse, isLoading: isLoadingCustomers } = useQuery<{
    data: AssignedCustomer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["staff-customers", id, page, search],
    queryFn: async () => {
      const q = encodeURIComponent(search);
      const res = await fetch(
        `/api/staff/${id}/customers?page=${page}&limit=20&search=${q}`
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json;
    },
    enabled: canViewStaff
  });

  // 3. Fetch all active staff for reassignment dropdown
  const { data: allStaff = [] } = useQuery<
    Array<{ id: string; name: string; email: string }>
  >({
    queryKey: ["staff-list-reassign"],
    queryFn: async () => {
      const res = await fetch("/api/staff");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return (
        json.data as Array<{
          id: string;
          name: string;
          email: string;
          isActive: boolean;
        }>
      )
        .filter((s) => s.id !== id && s.isActive)
        .map((s) => ({ id: s.id, name: s.name, email: s.email }));
    },
    enabled: isReassignModalOpen
  });

  // Reassignment Mutation
  const reassignMutation = useMutation({
    mutationFn: async ({
      toStaffId,
      customerIds
    }: {
      toStaffId: string | null;
      customerIds?: string[];
    }) => {
      const res = await fetch(`/api/staff/${id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStaffId, customerIds })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Reassigned successfully!");
      setIsReassignModalOpen(false);
      setSelectedCustomerIds([]);
      queryClient.invalidateQueries({ queryKey: ["staff-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["staff-customers", id] });
      queryClient.invalidateQueries({ queryKey: ["distribution-stats"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Reassignment failed");
    }
  });

  const customers = customersResponse?.data || [];
  const pagination = customersResponse?.pagination;

  if (isLoadingStaff) {
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <Loader2 className="text-cf-orange size-6 animate-spin" />
      </div>
    );
  }

  if (isStaffError || !staff) {
    return (
      <div className="bg-background flex h-full flex-col items-center justify-center p-6 text-center select-none">
        <AlertCircle className="text-destructive mb-2 size-8" />
        <h2 className="text-foreground text-base font-semibold">
          Staff Member Not Found
        </h2>
        <p className="text-muted-foreground mt-1 mb-4 text-xs">
          This staff account does not exist or may have been deleted.
        </p>
        <Link href="/staff">
          <Button variant="outline" size="sm" className="text-xs">
            Back to Staff List
          </Button>
        </Link>
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
              <div className="flex items-center gap-2">
                <h1 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
                  {staff.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                    staff.isActive
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {staff.isActive ? (
                    <>
                      <CheckCircle2 className="size-2.5" /> Active
                    </>
                  ) : (
                    <>
                      <XCircle className="size-2.5" /> Deactivated
                    </>
                  )}
                </span>
                <span className="bg-cf-orange/10 text-cf-orange rounded px-2 py-0.5 text-[10px] font-semibold">
                  {staff.role.name}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                {staff.email} {staff.phone ? `• ${staff.phone}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/staff/distribution">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-cf-orange border-cf-orange/40 hover:bg-cf-orange/10 h-8 cursor-pointer gap-1.5 text-xs"
              >
                <Sliders className="size-3.5" />
                <span>Customer Distribution</span>
              </Button>
            </Link>

            {canAssign && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCustomerIds([]);
                  setIsReassignModalOpen(true);
                }}
                disabled={staff._count.assignedCustomers === 0}
                className="h-8 cursor-pointer gap-1.5 text-xs"
              >
                <ArrowRightLeft className="size-3.5" />
                <span>Reassign All Customers</span>
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">
                Assigned Customers
              </span>
              <Users className="text-cf-orange size-4" />
            </div>
            <span className="text-foreground mt-2 block font-mono text-2xl font-bold">
              {staff._count.assignedCustomers}
            </span>
          </div>

          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">
                Role & Permissions
              </span>
              <ShieldCheck className="size-4 text-emerald-500" />
            </div>
            <span className="text-foreground mt-2 block font-mono text-2xl font-bold">
              {staff.role.permissions.length} perms
            </span>
          </div>

          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">
                Member Since
              </span>
              <Clock className="text-muted-foreground size-4" />
            </div>
            <span className="text-foreground mt-2 block text-sm font-semibold">
              {new Date(staff.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Assigned Customers Section */}
        <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-foreground text-sm font-semibold">
                Customers Assigned to {staff.name}
              </h2>
              <p className="text-muted-foreground text-xs">
                All contacts assigned to this staff member by email
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canAssign && selectedCustomerIds.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsReassignModalOpen(true)}
                  className="text-cf-orange border-cf-orange/40 hover:bg-cf-orange/10 h-8 cursor-pointer gap-1.5 text-xs"
                >
                  <ArrowRightLeft className="size-3" />
                  <span>Reassign Selected ({selectedCustomerIds.length})</span>
                </Button>
              )}

              <div className="relative w-64">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search assigned contacts..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Customers Table */}
          <div className="border-border overflow-hidden rounded-lg border">
            {isLoadingCustomers ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="text-cf-orange size-5 animate-spin" />
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="text-muted-foreground/40 mb-2 size-8" />
                <p className="text-foreground text-xs font-medium">
                  No customers assigned yet
                </p>
                <p className="text-muted-foreground mt-0.5 mb-3 text-[11px]">
                  Use the distribution page to allocate contacts to {staff.name}
                  .
                </p>
                <Link href="/staff/distribution">
                  <Button size="sm" variant="outline" className="text-xs">
                    Distribute Customers Now
                  </Button>
                </Link>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-border border-b text-left">
                  <tr>
                    {canAssign && (
                      <th className="w-8 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={
                            customers.length > 0 &&
                            selectedCustomerIds.length === customers.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCustomerIds(
                                customers.map((c) => c.id)
                              );
                            } else {
                              setSelectedCustomerIds([]);
                            }
                          }}
                          className="accent-cf-orange size-3.5 cursor-pointer rounded"
                        />
                      </th>
                    )}
                    <th className="text-muted-foreground px-3 py-2.5 font-medium">
                      Contact Name
                    </th>
                    <th className="text-muted-foreground px-3 py-2.5 font-medium">
                      Phone Number
                    </th>
                    <th className="text-muted-foreground px-3 py-2.5 font-medium">
                      Status
                    </th>
                    <th className="text-muted-foreground px-3 py-2.5 font-medium">
                      Tags
                    </th>
                    <th className="text-muted-foreground px-3 py-2.5 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {customers.map((c) => {
                    const isChecked = selectedCustomerIds.includes(c.id);
                    const displayName =
                      c.customName || c.whatsappName || "Unknown Contact";

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-muted/20 transition-colors ${
                          isChecked ? "bg-cf-orange/5" : ""
                        }`}
                      >
                        {canAssign && (
                          <td className="px-3 py-2.5">
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
                        )}
                        <td className="text-foreground px-3 py-2.5 font-semibold">
                          {displayName}
                        </td>
                        <td className="text-muted-foreground px-3 py-2.5 font-mono">
                          {c.normalizedPhone}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`py-0.2 rounded px-1.5 text-[10px] font-semibold ${
                              c.state === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {c.state}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(c.tags || []).slice(0, 3).map((t, idx) => (
                              <span
                                key={idx}
                                className="bg-muted py-0.2 rounded px-1.5 text-[10px] font-medium"
                              >
                                {t.tag.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/?customerId=${c.id}`}>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground h-6 cursor-pointer gap-1 px-2 text-[11px]"
                                title="Open chat"
                              >
                                <MessageSquare className="text-cf-orange size-3" />
                                <span>Chat</span>
                              </Button>
                            </Link>

                            {canAssign && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  reassignMutation.mutate({
                                    toStaffId: null,
                                    customerIds: [c.id]
                                  });
                                }}
                                className="text-destructive hover:bg-destructive/10 h-6 cursor-pointer px-2 text-[11px]"
                                title="Unassign contact"
                              >
                                <UserMinus className="size-3" />
                                <span>Unassign</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Bar */}
          {pagination && pagination.totalPages > 1 && (
            <div className="text-muted-foreground flex items-center justify-between pt-2 text-xs">
              <span>
                Showing {(pagination.page - 1) * pagination.limit + 1} -{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} contacts
              </span>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(pagination.page - 1)}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="px-2 font-mono">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(pagination.page + 1)}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reassign Modal */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="border-border bg-card w-full max-w-md space-y-4 rounded-xl border p-5 shadow-xl">
            <div className="border-border/60 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="text-cf-orange size-4" />
                <h3 className="text-foreground text-sm font-semibold">
                  {selectedCustomerIds.length > 0
                    ? `Reassign ${selectedCustomerIds.length} Selected Contacts`
                    : `Reassign All ${staff._count.assignedCustomers} Contacts`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReassignModalOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-muted-foreground text-xs">
              Choose which staff member will take over handling these contacts:
            </p>

            <div className="space-y-3">
              <label className="text-foreground block text-xs font-medium">
                Destination Staff Member:
              </label>
              <select
                value={targetStaffId}
                onChange={(e) => setTargetStaffId(e.target.value)}
                className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-xs focus-visible:ring-1 focus-visible:outline-none"
              >
                <option value="">(Select staff member)</option>
                <option value="unassign">-- Unassign (Remove Staff) --</option>
                {allStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="border-border/60 flex items-center justify-end gap-2 border-t pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReassignModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!targetStaffId) {
                    toast.error("Please select a target staff member");
                    return;
                  }
                  reassignMutation.mutate({
                    toStaffId:
                      targetStaffId === "unassign" ? null : targetStaffId,
                    customerIds:
                      selectedCustomerIds.length > 0
                        ? selectedCustomerIds
                        : undefined
                  });
                }}
                disabled={reassignMutation.isPending || !targetStaffId}
                className="bg-cf-orange hover:bg-cf-orange/90 h-8 cursor-pointer px-4 text-xs font-semibold text-white"
              >
                {reassignMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  "Confirm Reassign"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
