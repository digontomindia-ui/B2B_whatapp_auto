"use client";

import {
  ArrowLeft,
  FolderKanban,
  Users,
  Radio,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  Send,
  UserMinus,
  UserPlus,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Phone,
  Check
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { toast } from "sonner";
import Link from "next/link";

interface CustomerItem {
  id: string;
  phoneNumber: string;
  normalizedPhone: string;
  customName: string | null;
  whatsappName: string | null;
  companyName: string | null;
  status: "HOT" | "WARM" | "COLD";
  state: "ACTIVE" | "BLOCKED" | "OPTED_OUT";
  createdAt: string;
  lastInteractionAt: string | null;
  assignedStaff: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface BroadcastItem {
  id: string;
  type: "MESSAGE" | "TEMPLATE";
  status: string;
  title: string | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
  completedAt: string | null;
}

interface GroupDetailResponse {
  error: boolean;
  message: string;
  data: {
    group: {
      id: string;
      name: string;
      description: string | null;
      color: string;
      createdAt: string;
      updatedAt: string;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    customers: CustomerItem[];
    broadcasts: BroadcastItem[];
    stats: {
      customerCount: number;
      broadcastCount: number;
      totalSent: number;
      totalDelivered: number;
      totalRead: number;
      deliveryRate: number;
      readRate: number;
    };
  };
}

interface AvailableCustomerItem {
  id: string;
  phoneNumber: string;
  normalizedPhone: string;
  customName: string | null;
  whatsappName: string | null;
  companyName: string | null;
  status: string;
  state: string;
  groupId: string | null;
  group?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export default function GroupDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const groupId = resolvedParams.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission, isOwner } = useAuth();
  const canManage = isOwner || hasPermission(PERMISSIONS.GROUP_MANAGE);

  const [activeTab, setActiveTab] = useState<"customers" | "broadcasts">(
    "customers"
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selection for bulk customer removal
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(
    new Set()
  );

  // Add Customers Modal State
  const [isAddCustomersOpen, setIsAddCustomersOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalSelectedIds, setModalSelectedIds] = useState<Set<string>>(
    new Set()
  );

  // Fetch Group Details with paginated customers and broadcasts
  const { data, isLoading, isError, error, refetch } =
    useQuery<GroupDetailResponse>({
      queryKey: ["group-detail", groupId, currentPage, customerSearch],
      queryFn: async () => {
        const queryParams = new URLSearchParams({
          page: String(currentPage),
          limit: String(pageSize),
          search: customerSearch
        });
        const res = await fetch(`/api/groups/${groupId}?${queryParams.toString()}`);
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.message);
        return json;
      }
    });

  const group = data?.data?.group;
  const customers = data?.data?.customers || [];
  const broadcasts = data?.data?.broadcasts || [];
  const pagination = data?.data?.pagination;
  const stats = data?.data?.stats;

  // Query available customers to add to this group
  const {
    data: availableCustomersData,
    isLoading: isLoadingAvailable,
    refetch: refetchAvailable
  } = useQuery<{ error: boolean; data: AvailableCustomerItem[] }>({
    queryKey: ["available-customers", groupId, modalSearch],
    queryFn: async () => {
      const q = new URLSearchParams({ search: modalSearch, limit: "30" });
      const res = await fetch(
        `/api/groups/${groupId}/customers?${q.toString()}`
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json;
    },
    enabled: isAddCustomersOpen
  });

  const availableCustomers = availableCustomersData?.data || [];

  // Mutation: Add customers into group
  const addCustomersMutation = useMutation({
    mutationFn: async (customerIds: string[]) => {
      const res = await fetch(`/api/groups/${groupId}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Customers added to group");
      queryClient.invalidateQueries({ queryKey: ["group-detail", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsAddCustomersOpen(false);
      setModalSelectedIds(new Set());
      setModalSearch("");
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to add customers"
      );
    }
  });

  // Mutation: Remove customers from group
  const removeCustomersMutation = useMutation({
    mutationFn: async (customerIds: string[]) => {
      const res = await fetch(`/api/groups/${groupId}/customers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Customers removed from group");
      queryClient.invalidateQueries({ queryKey: ["group-detail", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setSelectedCustomerIds(new Set());
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove customers"
      );
    }
  });

  function toggleSelectCustomer(id: string) {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllCurrent() {
    if (selectedCustomerIds.size === customers.length && customers.length > 0) {
      setSelectedCustomerIds(new Set());
    } else {
      setSelectedCustomerIds(new Set(customers.map((c) => c.id)));
    }
  }

  function toggleModalSelect(id: string) {
    setModalSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAddSelectedCustomers() {
    if (modalSelectedIds.size === 0) {
      toast.error("Please select at least one customer to add");
      return;
    }
    addCustomersMutation.mutate(Array.from(modalSelectedIds));
  }

  function handleRemoveSelected() {
    if (selectedCustomerIds.size === 0) return;
    if (
      confirm(
        `Remove ${selectedCustomerIds.size} customer(s) from this group? They will remain in your contacts.`
      )
    ) {
      removeCustomersMutation.mutate(Array.from(selectedCustomerIds));
    }
  }

  function handleRemoveSingle(customerId: string) {
    if (
      confirm(
        "Remove this customer from this group? The contact record will not be deleted."
      )
    ) {
      removeCustomersMutation.mutate([customerId]);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-12 text-center">
        <Loader2 className="text-cf-orange size-8 animate-spin" />
        <p className="text-foreground mt-3 text-sm font-semibold">
          Loading Group Details...
        </p>
      </div>
    );
  }

  if (isError || !group) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-12 text-center">
        <div className="bg-destructive/15 text-destructive rounded-full p-3">
          <AlertCircle className="size-6" />
        </div>
        <h2 className="text-foreground mt-3 text-sm font-bold">
          Group Not Found
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          {error instanceof Error ? error.message : "The group could not be loaded."}
        </p>
        <Link
          href="/groups"
          className="bg-cf-orange text-white mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Groups</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Top Header */}
      <div className="border-border bg-card/60 sticky top-0 z-20 border-b px-6 py-4 backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/groups"
              className="border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border p-2 transition-colors"
              title="Back to all groups"
            >
              <ArrowLeft className="size-4" />
            </Link>

            <div className="flex items-center gap-2.5">
              <div
                className="flex size-9 items-center justify-center rounded-lg font-bold text-white shadow-xs"
                style={{ backgroundColor: group.color || "#f6821f" }}
              >
                {group.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-foreground text-lg font-bold tracking-tight">
                    {group.name}
                  </h1>
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  {group.description || "Customer group for broadcasts and segmented messaging."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <button
                onClick={() => {
                  setIsAddCustomersOpen(true);
                  setModalSearch("");
                  setModalSelectedIds(new Set());
                }}
                className="bg-cf-orange hover:bg-[#e87516] text-white shadow-cf-orange/20 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
              >
                <UserPlus className="size-3.5" />
                <span>+ Add Customers</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Total Members
              </span>
              <Users className="text-blue-500 size-4" />
            </div>
            <div className="text-foreground mt-2 font-mono text-2xl font-extrabold">
              {stats?.customerCount.toLocaleString() || 0}
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Assigned customers in group
            </p>
          </div>

          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Broadcast Campaigns
              </span>
              <Radio className="text-cf-orange size-4" />
            </div>
            <div className="text-foreground mt-2 font-mono text-2xl font-extrabold">
              {stats?.broadcastCount.toLocaleString() || 0}
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Broadcasts targeting this group
            </p>
          </div>

          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Delivery Success
              </span>
              <CheckCircle2 className="text-emerald-500 size-4" />
            </div>
            <div className="text-foreground mt-2 font-mono text-2xl font-extrabold">
              {stats?.deliveryRate || 0}%
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              {stats?.totalDelivered.toLocaleString() || 0} of {stats?.totalSent.toLocaleString() || 0} delivered
            </p>
          </div>

          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Read Rate
              </span>
              <Clock className="text-purple-500 size-4" />
            </div>
            <div className="text-foreground mt-2 font-mono text-2xl font-extrabold">
              {stats?.readRate || 0}%
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              {stats?.totalRead.toLocaleString() || 0} read receipts
            </p>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="border-border bg-card rounded-xl border shadow-xs overflow-hidden">
          <div className="border-border flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("customers")}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === "customers"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="size-3.5" />
                <span>Customers in Group</span>
                <span className="bg-cf-orange/15 text-cf-orange text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {stats?.customerCount || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("broadcasts")}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === "broadcasts"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Radio className="size-3.5" />
                <span>Broadcast History</span>
                <span className="bg-muted-foreground/15 text-muted-foreground text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {stats?.broadcastCount || 0}
                </span>
              </button>
            </div>

            {activeTab === "customers" && selectedCustomerIds.size > 0 && canManage && (
              <button
                onClick={handleRemoveSelected}
                disabled={removeCustomersMutation.isPending}
                className="bg-destructive/15 text-destructive hover:bg-destructive/25 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
              >
                <UserMinus className="size-3.5" />
                <span>Remove {selectedCustomerIds.size} Selected</span>
              </button>
            )}
          </div>

          {/* TAB 1: CUSTOMERS TABLE (PAGINATED) */}
          {activeTab === "customers" && (
            <div className="p-5 space-y-4">
              {/* Search & Actions Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search customers in this group..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:ring-cf-orange w-full rounded-lg border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {canManage && (
                    <button
                      onClick={() => {
                        setIsAddCustomersOpen(true);
                        setModalSearch("");
                        setModalSelectedIds(new Set());
                      }}
                      className="border-border bg-background text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition-colors"
                    >
                      <Plus className="size-3 text-cf-orange" />
                      <span>Add Customers</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="border-border rounded-lg border overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground border-border border-b text-[11px] font-semibold uppercase tracking-wider">
                    <tr>
                      {canManage && (
                        <th className="px-3 py-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              customers.length > 0 &&
                              selectedCustomerIds.size === customers.length
                            }
                            onChange={toggleSelectAllCurrent}
                            className="accent-cf-orange rounded"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-3 py-3">Phone Number</th>
                      <th className="px-3 py-3">Company / School</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">State</th>
                      <th className="px-3 py-3">Added Date</th>
                      {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {customers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={canManage ? 8 : 7}
                          className="text-muted-foreground px-4 py-10 text-center text-xs"
                        >
                          {customerSearch.trim()
                            ? "No customers match your search query."
                            : "No customers have been added to this group yet."}
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
                        <tr
                          key={c.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          {canManage && (
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={selectedCustomerIds.has(c.id)}
                                onChange={() => toggleSelectCustomer(c.id)}
                                className="accent-cf-orange rounded cursor-pointer"
                              />
                            </td>
                          )}

                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">
                              {c.customName || c.whatsappName || "Unnamed Contact"}
                            </div>
                            {c.whatsappName && c.customName && (
                              <div className="text-muted-foreground text-[10px]">
                                WA: {c.whatsappName}
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-3 font-mono text-muted-foreground">
                            {c.normalizedPhone || c.phoneNumber}
                          </td>

                          <td className="px-3 py-3 text-muted-foreground">
                            {c.companyName || "—"}
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                c.status === "HOT"
                                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                  : c.status === "WARM"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                c.state === "ACTIVE"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : "bg-destructive/15 text-destructive"
                              }`}
                            >
                              {c.state}
                            </span>
                          </td>

                          <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>

                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleRemoveSingle(c.id)}
                                title="Remove customer from group"
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 inline-flex cursor-pointer items-center gap-1 rounded p-1 text-[11px] font-medium transition-colors"
                              >
                                <UserMinus className="size-3.5" />
                                <span>Remove</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                  <div className="text-muted-foreground font-mono">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="border-border bg-background text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 font-medium disabled:opacity-40"
                    >
                      <ChevronLeft className="size-3.5" />
                      <span>Prev</span>
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min(pagination.totalPages, p + 1)
                        )
                      }
                      disabled={currentPage >= pagination.totalPages}
                      className="border-border bg-background text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 font-medium disabled:opacity-40"
                    >
                      <span>Next</span>
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BROADCASTS TABLE */}
          {activeTab === "broadcasts" && (
            <div className="p-5 space-y-4">
              <div className="border-border rounded-lg border overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground border-border border-b text-[11px] font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Broadcast Title</th>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Recipients</th>
                      <th className="px-3 py-3 text-right">Sent</th>
                      <th className="px-3 py-3 text-right">Delivered</th>
                      <th className="px-3 py-3 text-right">Read</th>
                      <th className="px-4 py-3 text-right">Dispatched At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {broadcasts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-muted-foreground px-4 py-10 text-center text-xs"
                        >
                          No broadcasts have targeted this group yet.
                        </td>
                      </tr>
                    ) : (
                      broadcasts.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">
                              {b.title || "Broadcast Job"}
                            </div>
                            <div className="text-muted-foreground font-mono text-[10px]">
                              ID: {b.id.slice(0, 8)}...
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <span className="border-border bg-muted/60 text-muted-foreground rounded border px-1.5 py-0.5 text-[10px] font-semibold">
                              {b.type}
                            </span>
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                b.status === "COMPLETED"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : b.status === "PARTIAL"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : b.status === "RUNNING"
                                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                  : "bg-destructive/15 text-destructive"
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>

                          <td className="px-3 py-3 text-right font-mono">
                            {b.totalRecipients.toLocaleString()}
                          </td>

                          <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">
                            {b.sentCount.toLocaleString()}
                          </td>

                          <td className="px-3 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                            {b.deliveredCount.toLocaleString()}
                          </td>

                          <td className="px-3 py-3 text-right font-mono text-purple-600 dark:text-purple-400">
                            {b.readCount.toLocaleString()}
                          </td>

                          <td className="px-4 py-3 text-right font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {new Date(b.createdAt).toLocaleString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ADD CUSTOMERS MODAL */}
      {isAddCustomersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs select-none">
          <div className="border-border bg-card flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
            <div className="border-border flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-foreground text-sm font-bold">
                  Add Customers to &quot;{group.name}&quot;
                </h2>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Select contacts to assign to this group. Customers belong to one group at a time.
                </p>
              </div>
              <button
                onClick={() => setIsAddCustomersOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-1 text-xs"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-border bg-muted/20">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search contacts by name, phone number, company..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:ring-cf-orange w-full rounded-lg border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
                />
              </div>
            </div>

            {/* Contacts Selection List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isLoadingAvailable ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="text-cf-orange size-6 animate-spin" />
                  <span className="text-muted-foreground mt-2 text-xs">
                    Searching available contacts...
                  </span>
                </div>
              ) : availableCustomers.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-xs">
                  {modalSearch.trim()
                    ? "No available contacts match your search."
                    : "All current contacts are already in this group."}
                </div>
              ) : (
                availableCustomers.map((cust) => {
                  const isSelected = modalSelectedIds.has(cust.id);
                  return (
                    <div
                      key={cust.id}
                      onClick={() => toggleModalSelect(cust.id)}
                      className={`border-border hover:border-cf-orange/40 flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                        isSelected ? "bg-cf-orange/5 border-cf-orange" : "bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-5 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "bg-cf-orange border-cf-orange text-white"
                              : "border-border bg-background"
                          }`}
                        >
                          {isSelected && <Check className="size-3 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="text-foreground text-xs font-semibold">
                            {cust.customName || cust.whatsappName || "Unnamed Contact"}
                          </div>
                          <div className="text-muted-foreground font-mono text-[11px] flex items-center gap-2">
                            <span>{cust.normalizedPhone || cust.phoneNumber}</span>
                            {cust.companyName && <span>• {cust.companyName}</span>}
                          </div>
                        </div>
                      </div>

                      {cust.group ? (
                        <div className="text-muted-foreground text-[10px]">
                          Reassign from: <span className="font-semibold text-foreground">{cust.group.name}</span>
                        </div>
                      ) : (
                        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                          No group
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-border flex items-center justify-between border-t px-5 py-3 bg-card">
              <span className="text-muted-foreground text-xs font-mono">
                {modalSelectedIds.size} customer(s) selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomersOpen(false)}
                  className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddSelectedCustomers}
                  disabled={modalSelectedIds.size === 0 || addCustomersMutation.isPending}
                  className="bg-cf-orange hover:bg-[#e87516] text-white inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {addCustomersMutation.isPending && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  <span>Add to Group ({modalSelectedIds.size})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
