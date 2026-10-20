"use client";

import type {
  DashboardMessage,
  DashboardBulkJob,
  DashboardTemplate,
  CustomersListResponse,
  DashboardGroup
} from "@/components/dashboard/types";
import {
  Search,
  UserPlus,
  Users,
  Layers,
  MessageSquare,
  Download,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery
} from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { CustomerStatus } from "@prisma/client";
import { CustomerDetailsSheet } from "@/components/dashboard/customer-details-sheet";
import { CreateCustomerDialog } from "@/components/dashboard/create-customer-dialog";
import { SendTemplateDialog } from "@/components/dashboard/send-template-dialog";
import { BulkTemplateDialog } from "@/components/dashboard/bulk-template-dialog";
import { BulkMessageDialog } from "@/components/dashboard/bulk-message-dialog";
import { ConversationView } from "@/components/dashboard/conversation-view";
import { BulkJobsDialog } from "@/components/dashboard/bulk-jobs-dialog";
import { CustomerList } from "@/components/dashboard/customer-list";
import { Composer } from "@/components/dashboard/composer";
import { ImportDialog } from "@/components/dashboard/import-dialog";
import { ExportDialog } from "@/components/dashboard/export-dialog";
import { useRealtime } from "@/hooks/use-realtime";
import { PERMISSIONS } from "@/lib/permissions";
import { useAuth } from "@/providers/auth";
import { toast } from "sonner";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { hasPermission, hasAnyPermission, isOwner } = useAuth();

  const canCreateCustomer =
    isOwner || hasPermission(PERMISSIONS.CUSTOMER_CREATE);
  const canExport = isOwner || hasPermission(PERMISSIONS.CUSTOMER_EXPORT);
  const canSendBulkMessage =
    isOwner || hasPermission(PERMISSIONS.BULK_MESSAGE_SEND);
  const canSendBulkTemplate =
    isOwner ||
    hasAnyPermission([
      PERMISSIONS.BULK_UTILITY_SEND,
      PERMISSIONS.BULK_MARKETING_SEND
    ]);

  // Search, filter, and sorting state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "all">(
    "all"
  );
  const [groupIdFilter, setGroupIdFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<
    "all" | "today" | "yesterday" | "last7days" | "last30days"
  >("all");
  const [commState, setCommState] = useState<
    "all" | "unread" | "read" | "blocked" | "opted_out" | "failed"
  >("all");
  const [sort, setSort] = useState<
    | "newest_interaction"
    | "oldest_interaction"
    | "newest_customer"
    | "oldest_customer"
  >("newest_interaction");

  // Selection & active state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(
    new Set()
  );

  // Dialog & drawer visibility states
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);

  const [isSendTemplateOpen, setIsSendTemplateOpen] = useState(false);
  const [isBulkMessageOpen, setIsBulkMessageOpen] = useState(false);
  const [isBulkTemplateOpen, setIsBulkTemplateOpen] = useState(false);
  const [isBulkJobsOpen, setIsBulkJobsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Fetch groups for filter
  const { data: groupsData } = useQuery<{
    error: boolean;
    data: DashboardGroup[];
  }>({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups");
      const json = await res.json();
      return json;
    }
  });
  const groups = groupsData?.data || [];

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // 1. Fetch Customers Infinite Query (with pagination & infinite scroll)
  const {
    data: customersData,
    isLoading: isLoadingCustomers,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage
  } = useInfiniteQuery<CustomersListResponse>({
    queryKey: [
      "customers",
      debouncedSearch,
      statusFilter,
      groupIdFilter,
      dateRange,
      commState,
      sort
    ],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (groupIdFilter !== "all") params.set("groupId", groupIdFilter);
      if (dateRange !== "all") params.set("dateRange", dateRange);
      if (commState !== "all") params.set("communicationState", commState);
      params.set("sort", sort);
      params.set("page", String(pageParam));
      params.set("limit", "50");

      const res = await fetch(`/api/customers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage?.pagination?.page < lastPage?.pagination?.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    }
  });

  const customers = useMemo(
    () => customersData?.pages.flatMap((page) => page.customers) || [],
    [customersData]
  );

  const totalCount =
    customersData?.pages[0]?.pagination?.total ?? customers.length;

  const effectiveCustomerId = useMemo(() => {
    if (selectedCustomerId) {
      const found = customers.find((c) => c.id === selectedCustomerId);
      if (found) return found.id;
    }
    return customers[0]?.id ?? null;
  }, [customers, selectedCustomerId]);

  // Active customer
  const activeCustomer = useMemo(() => {
    if (!effectiveCustomerId) return null;
    return customers.find((c) => c.id === effectiveCustomerId) || null;
  }, [customers, effectiveCustomerId]);

  const activeConversationId = activeCustomer?.conversations?.[0]?.id || null;

  // Realtime hook subscription
  useRealtime(activeConversationId);

  // 2. Fetch Messages Query for active conversation
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    isFetching: isFetchingMessages,
    refetch: refetchMessages
  } = useQuery<DashboardMessage[]>({
    queryKey: ["messages", activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      const res = await fetch(
        `/api/conversations/${activeConversationId}/messages?limit=100`
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    enabled: !!activeConversationId
  });

  // Mark conversation as read when active customer has unread messages
  useEffect(() => {
    if (activeCustomer && activeCustomer.unreadCount > 0) {
      fetch("/api/messages/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: activeCustomer.id,
          conversationId: activeConversationId
        })
      }).catch(() => {});
    }
  }, [activeCustomer, activeConversationId]);

  // 3. Fetch Templates Query
  const { data: templates = [] } = useQuery<DashboardTemplate[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    }
  });

  // 4. Fetch Bulk Jobs Query
  const { data: bulkJobsData, isLoading: isLoadingBulkJobs } = useQuery<{
    jobs: DashboardBulkJob[];
  }>({
    queryKey: ["bulk-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/bulk/jobs");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    }
  });

  const bulkJobs = bulkJobsData?.jobs || [];

  // 5. Fetch Funds Data Query
  const { data: fundsApiResponse } = useQuery<{
    error: boolean;
    data: {
      summary: {
        balance: number;
        currencySymbol: string;
        totalSpend: number;
        accountHealth: string;
        addFundsUrl: string;
      };
    };
  }>({
    queryKey: ["fundsData"],
    queryFn: async () => {
      const res = await fetch("/api/funds");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30000
  });

  const fundsSummary = fundsApiResponse?.data?.summary;

  // Mutations for sending
  const sendTextMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!activeCustomer) throw new Error("No customer selected");
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: activeCustomer.id,
          conversationId: activeConversationId || undefined,
          text
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", activeConversationId]
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (data?.status === "FAILED") {
        toast.error(
          `Message rejected by Meta: ${data.errorMessage || "Failed"}`
        );
      }
    }
  });

  const sendMediaMutation = useMutation({
    mutationFn: async (payload: {
      type: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO";
      mediaLink?: string;
      caption?: string;
      fileName?: string;
    }) => {
      if (!activeCustomer) throw new Error("No customer selected");
      const res = await fetch("/api/messages/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: activeCustomer.id,
          conversationId: activeConversationId || undefined,
          ...payload
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", activeConversationId]
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (data?.status === "FAILED") {
        toast.error(`Media rejected by Meta: ${data.errorMessage || "Failed"}`);
      } else {
        toast.success("Media message sent");
      }
    }
  });

  // Bulk recipient helpers
  function toggleSelectCustomer(id: string) {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedCustomerIds(new Set(customers.map((c) => c.id)));
  }

  function clearSelection() {
    setSelectedCustomerIds(new Set());
  }

  async function handleRefreshMessages() {
    try {
      await Promise.all([
        refetchMessages(),
        queryClient.invalidateQueries({ queryKey: ["customers"] })
      ]);
      toast.success("Messages synchronized");
    } catch {
      toast.error("Failed to sync messages");
    }
  }

  const selectedCustomersForBulk = useMemo(() => {
    return customers.filter((c) => selectedCustomerIds.has(c.id));
  }, [customers, selectedCustomerIds]);

  return (
    <div className="bg-background flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* ------------------------------------------------------------- */}
      {/* TOP COMMAND BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="border-border bg-card shrink-0 border-b px-4 py-2.5 shadow-2xs">
        <div className="flex flex-col items-stretch justify-between gap-2.5 lg:flex-row lg:items-center">
          {/* Left search & filter controls */}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative max-w-xs min-w-44 flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search all fields (phone, name, notes, tags, messages...)"
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded-md border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
              />
            </div>

            {/* Quick Filter: Status */}
            <div className="bg-muted/50 border-border flex items-center gap-1 rounded-md border p-0.5 text-[11px]">
              <span className="text-muted-foreground hidden pr-0.5 pl-1.5 text-[10px] font-semibold tracking-wider uppercase sm:inline">
                Status:
              </span>
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`cursor-pointer rounded px-2 py-1 transition-colors ${
                  statusFilter === "all"
                    ? "bg-background text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("HOT")}
                className={`inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 transition-colors ${
                  statusFilter === "HOT"
                    ? "border border-rose-500/30 bg-rose-500/15 font-bold text-rose-600 shadow-2xs dark:text-rose-400"
                    : "text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                }`}
              >
                Hot
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("WARM")}
                className={`inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 transition-colors ${
                  statusFilter === "WARM"
                    ? "border border-amber-500/30 bg-amber-500/15 font-bold text-amber-600 shadow-2xs dark:text-amber-400"
                    : "text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
                }`}
              >
                Warm
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("COLD")}
                className={`inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 transition-colors ${
                  statusFilter === "COLD"
                    ? "border border-sky-500/30 bg-sky-500/15 font-bold text-sky-600 shadow-2xs dark:text-sky-400"
                    : "text-muted-foreground hover:text-sky-600 dark:hover:text-sky-400"
                }`}
              >
                Cold
              </button>
            </div>

            {/* Date filter dropdown */}
            <select
              value={dateRange}
              //@ts-expect-error nothing
              onChange={(e) => setDateRange(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-cf-orange cursor-pointer rounded-md border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
            >
              <option value="all">Date: All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
            </select>

            {/* Group filter dropdown */}
            <select
              value={groupIdFilter}
              onChange={(e) => setGroupIdFilter(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-cf-orange cursor-pointer rounded-md border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
            >
              <option value="all">Group: All Groups</option>
              <option value="none">Group: Unassigned</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  Group: {g.name}
                </option>
              ))}
            </select>

            {/* Communication state filters */}
            <div className="bg-muted/50 border-border flex items-center gap-1 rounded-md border p-0.5 text-[11px]">
              <button
                onClick={() => setCommState("all")}
                className={`cursor-pointer rounded px-2 py-1 ${
                  commState === "all"
                    ? "bg-background text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setCommState("unread")}
                className={`cursor-pointer rounded px-2 py-1 ${
                  commState === "unread"
                    ? "bg-background text-cf-orange font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setCommState("blocked")}
                className={`cursor-pointer rounded px-2 py-1 ${
                  commState === "blocked"
                    ? "bg-background font-semibold text-red-500 shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Blocked
              </button>
              <button
                onClick={() => setCommState("opted_out")}
                className={`cursor-pointer rounded px-2 py-1 ${
                  commState === "opted_out"
                    ? "bg-background font-semibold text-amber-500 shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Opted Out
              </button>
              <button
                onClick={() => setCommState("failed")}
                className={`cursor-pointer rounded px-2 py-1 ${
                  commState === "failed"
                    ? "bg-background text-destructive font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Failed
              </button>
            </div>

            {/* Sort selector */}
            <select
              value={sort}
              //@ts-expect-error nothing
              onChange={(e) => setSort(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-cf-orange cursor-pointer rounded-md border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
            >
              <option value="newest_interaction">Sort: Newest Activity</option>
              <option value="oldest_interaction">Sort: Oldest Activity</option>
              <option value="newest_customer">Sort: Newest Contact</option>
              <option value="oldest_customer">Sort: Oldest Contact</option>
            </select>
          </div>

          {/* Right Action Area */}
          <div className="flex items-center gap-2">
            {/* Funds Details on Dashboard */}
            {fundsSummary && (
              <div className="border-border bg-muted/40 hidden items-center gap-2 rounded-md border px-2.5 py-1 text-xs md:flex">
                <Link
                  href="/funds"
                  className="text-foreground hover:text-cf-orange flex items-center gap-1.5 transition-colors"
                  title="View Funds &amp; Analytics"
                >
                  <span className="font-mono font-bold">
                    {fundsSummary.currencySymbol}
                    {fundsSummary.balance.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                  <span
                    className="size-1.5 animate-pulse rounded-full bg-emerald-500"
                    title="Healthy Balance"
                  ></span>
                </Link>

                <div className="bg-border h-3 w-px"></div>

                <a
                  href={fundsSummary.addFundsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cf-orange inline-flex items-center gap-0.5 text-[11px] font-semibold transition-colors hover:text-[#e87516]"
                  title="Add Funds via WhatsApp Manager"
                >
                  <span>+ Add</span>
                  <ExternalLink className="size-2.5" />
                </a>
              </div>
            )}

            {selectedCustomerIds.size > 0 ? (
              <div className="bg-cf-orange/10 border-cf-orange/30 flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs">
                <span className="text-cf-orange font-semibold whitespace-nowrap">
                  {selectedCustomerIds.size} selected
                </span>
                <span className="text-muted-foreground/40">|</span>
                {canSendBulkMessage && (
                  <button
                    type="button"
                    onClick={() => setIsBulkMessageOpen(true)}
                    className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#e87516]"
                  >
                    <Users className="size-3.5" />
                    <span>Send Bulk Message</span>
                  </button>
                )}
                {canSendBulkTemplate && (
                  <button
                    type="button"
                    onClick={() => setIsBulkTemplateOpen(true)}
                    className="border-border bg-background text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <Layers className="text-cf-orange size-3.5" />
                    <span>Send Bulk Template</span>
                  </button>
                )}
                {canExport && (
                  <button
                    type="button"
                    onClick={() => setIsExportOpen(true)}
                    className="border-border bg-background text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <Download className="text-cf-orange size-3.5" />
                    <span>Export</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-muted-foreground hover:text-foreground cursor-pointer px-1 text-xs"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {canCreateCustomer && (
                  <button
                    type="button"
                    onClick={() => setIsCreateCustomerOpen(true)}
                    className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-white shadow-2xs transition-colors hover:bg-[#e87516]"
                  >
                    <UserPlus className="size-3.5" />
                    <span>Add Contact</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CRM INBOX SPLIT LAYOUT */}
      {/* ------------------------------------------------------------- */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Column: Customer List (WhatsApp Inbox) */}
        <div className="flex h-full w-full shrink-0 flex-col sm:w-80 md:w-96">
          <CustomerList
            customers={customers}
            selectedCustomerId={effectiveCustomerId}
            onSelectCustomer={(cust) => setSelectedCustomerId(cust.id)}
            isLoading={isLoadingCustomers}
            selectedIds={selectedCustomerIds}
            onToggleSelect={toggleSelectCustomer}
            onSelectAllVisible={selectAllVisible}
            onClearSelection={clearSelection}
            totalCount={totalCount}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
        </div>

        {/* Center / Right Column: Active Conversation */}
        <div className="bg-background hidden h-full min-w-0 flex-1 flex-col sm:flex">
          {activeCustomer ? (
            <ConversationView
              customer={activeCustomer}
              messages={messages}
              isLoadingMessages={isLoadingMessages}
              isRefreshingMessages={isFetchingMessages}
              onRefreshMessages={handleRefreshMessages}
              onOpenDetails={() => setIsDetailsOpen(true)}
              onOpenTemplateDialog={() => setIsSendTemplateOpen(true)}
              onCustomerDeleted={() => {
                setSelectedCustomerId(null);
                queryClient.invalidateQueries({ queryKey: ["customers"] });
                queryClient.invalidateQueries({ queryKey: ["messages"] });
              }}
            >
              <Composer
                onSendText={async (text) => {
                  await sendTextMutation.mutateAsync(text);
                }}
                onSendMedia={async (payload) => {
                  await sendMediaMutation.mutateAsync(payload);
                }}
                onOpenTemplate={() => setIsSendTemplateOpen(true)}
                disabled={
                  sendTextMutation.isPending || sendMediaMutation.isPending
                }
              />
            </ConversationView>
          ) : (
            <div className="text-muted-foreground bg-muted/10 flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="bg-card border-border mb-3 rounded-full border p-4 shadow-sm">
                <MessageSquare className="text-cf-orange size-8" />
              </div>
              <h2 className="text-foreground text-base font-semibold">
                No conversation selected
              </h2>
              <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                Pick a contact from the customer list on the left, or create a
                customer to initiate realtime WhatsApp communication.
              </p>
              {canCreateCustomer && (
                <button
                  onClick={() => setIsCreateCustomerOpen(true)}
                  className="bg-cf-orange mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#e87516]"
                >
                  <UserPlus className="size-3.5" />
                  <span>Create New Customer</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CONTEXTUAL SHEETS & DIALOGS */}
      {/* ------------------------------------------------------------- */}

      {/* 1. Customer Profile Details Drawer */}
      <CustomerDetailsSheet
        customer={activeCustomer}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        onUpdateCustomer={async (id, data) => {
          const res = await fetch(`/api/customers/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          });
          const json = await res.json();
          if (!res.ok || json.error) throw new Error(json.message);
          queryClient.invalidateQueries({ queryKey: ["customers"] });
        }}
      />

      {/* 2. Create Customer Dialog */}
      <CreateCustomerDialog
        isOpen={isCreateCustomerOpen}
        onClose={() => setIsCreateCustomerOpen(false)}
        onCustomerCreated={(cust) => {
          queryClient.invalidateQueries({ queryKey: ["customers"] });
          setSelectedCustomerId(cust.id);
        }}
      />

      {/* 4. Send Template Dialog */}
      <SendTemplateDialog
        isOpen={isSendTemplateOpen}
        onClose={() => setIsSendTemplateOpen(false)}
        customer={activeCustomer}
        templates={templates}
        onSent={() => {
          queryClient.invalidateQueries({
            queryKey: ["messages", activeConversationId]
          });
          queryClient.invalidateQueries({ queryKey: ["customers"] });
        }}
      />

      {/* 5. Bulk Message Dialog */}
      <BulkMessageDialog
        isOpen={isBulkMessageOpen}
        onClose={() => setIsBulkMessageOpen(false)}
        selectedCustomers={selectedCustomersForBulk}
        onStarted={() => {
          queryClient.invalidateQueries({ queryKey: ["bulk-jobs"] });
          setIsBulkJobsOpen(true);
        }}
      />

      {/* 6. Bulk Template Dialog */}
      <BulkTemplateDialog
        isOpen={isBulkTemplateOpen}
        onClose={() => setIsBulkTemplateOpen(false)}
        selectedCustomers={selectedCustomersForBulk}
        templates={templates}
        onStarted={() => {
          queryClient.invalidateQueries({ queryKey: ["bulk-jobs"] });
          setIsBulkJobsOpen(true);
        }}
      />

      <BulkJobsDialog
        isOpen={isBulkJobsOpen}
        onClose={() => setIsBulkJobsOpen(false)}
        jobs={bulkJobs}
        isLoading={isLoadingBulkJobs}
      />

      {/* 7. Import Dialog */}
      <ImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["customers"] });
          queryClient.invalidateQueries({ queryKey: ["groups"] });
        }}
      />

      {/* 8. Export Dialog */}
      <ExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        selectedCustomerIds={selectedCustomerIds}
        totalCustomersCount={totalCount}
        activeFilterParams={{
          search: debouncedSearch || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          groupId: groupIdFilter !== "all" ? groupIdFilter : undefined,
          dateRange: dateRange !== "all" ? dateRange : undefined,
          communicationState: commState !== "all" ? commState : undefined
        }}
      />
    </div>
  );
}
