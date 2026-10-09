"use client";

import type {
  DashboardTemplate,
  DashboardCustomer
} from "@/components/dashboard/types";
import {
  Layers,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Phone,
  MessageSquare,
  Send,
  Loader2,
  Lock,
  Plus
} from "lucide-react";
import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { SendTemplateDialog } from "@/components/dashboard/send-template-dialog";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isOwner } = useAuth();

  const canView = isOwner || hasPermission(PERMISSIONS.TEMPLATE_VIEW);
  const canSync = isOwner || hasPermission(PERMISSIONS.TEMPLATE_CREATE);
  const canSendUtility =
    isOwner || hasPermission(PERMISSIONS.MESSAGE_SEND_UTILITY);
  const canSendMarketing =
    isOwner || hasPermission(PERMISSIONS.MESSAGE_SEND_MARKETING);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Selected template for sending
  const [selectedTemplateForSend, setSelectedTemplateForSend] =
    useState<DashboardTemplate | null>(null);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);

  // 1. Fetch templates
  const {
    data: templates = [],
    isLoading,
    isFetching
  } = useQuery<DashboardTemplate[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    enabled: canView
  });

  // 2. Fetch customers (for the send dialog target picker)
  const { data: customersData } = useQuery<{ customers: DashboardCustomer[] }>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers?limit=100");
      const json = await res.json();
      if (!res.ok || json.error) return { customers: [] };
      return json.data;
    }
  });

  const customers = customersData?.customers || [];

  // 3. Sync templates from Meta
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/templates/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    onSuccess: (data) => {
      toast.success(
        `Synchronized ${data?.syncedCount ?? 0} templates from Meta WhatsApp Business Account!`
      );
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to sync templates from Meta");
    }
  });

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesName = tpl.name.toLowerCase().includes(q);
        const matchesBody = tpl.components?.some((c) =>
          c.text?.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesBody) return false;
      }
      if (categoryFilter !== "all" && tpl.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "all" && tpl.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [templates, search, categoryFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = templates.length;
    const approved = templates.filter((t) => t.status === "APPROVED").length;
    const pending = templates.filter((t) => t.status === "PENDING").length;
    const rejected = templates.filter((t) => t.status === "REJECTED").length;
    return { total, approved, pending, rejected };
  }, [templates]);

  if (!canView) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="bg-destructive/10 text-destructive mb-3 rounded-full p-3">
          <Lock className="size-6" />
        </div>
        <h2 className="text-foreground text-base font-semibold">
          Access Restricted
        </h2>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          You do not have permission to view WhatsApp templates. Contact your
          administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden">
      {/* Top Controls Bar */}
      <div className="border-border bg-card shrink-0 space-y-3 border-b p-4 shadow-2xs">
        {/* Row 1: Search, Filter, Sync Button */}
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative max-w-xs min-w-48 flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search template name or text..."
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded-md border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-cf-orange cursor-pointer rounded-md border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
            >
              <option value="all">Category: All</option>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-cf-orange cursor-pointer rounded-md border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
            >
              <option value="all">Status: All</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {canSync && (
              <Link
                href="/templates/new"
                className="bg-cf-orange inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#e87516]"
              >
                <Plus className="size-3.5" />
                <span>Create Template</span>
              </Link>
            )}

            {canSync && (
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || isFetching}
                className="border-border bg-background text-foreground hover:bg-muted inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`size-3.5 ${syncMutation.isPending || isFetching ? "animate-spin" : ""}`}
                />
                <span>Sync with Meta</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Stat Pills */}
        <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-1 text-xs">
          <span className="text-muted-foreground mr-1 text-[11px] font-medium">
            Overview:
          </span>
          <span className="bg-muted text-foreground border-border rounded-md border px-2 py-0.5 text-[11px] font-medium">
            Total: <strong>{stats.total}</strong>
          </span>
          <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Approved: <strong>{stats.approved}</strong>
          </span>
          <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Pending: <strong>{stats.pending}</strong>
          </span>
          <span className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
            Rejected: <strong>{stats.rejected}</strong>
          </span>
        </div>
      </div>

      {/* Templates Grid Content */}
      <div className="bg-muted/10 flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="text-muted-foreground flex h-64 items-center justify-center gap-2 text-xs">
            <Loader2 className="text-cf-orange size-4 animate-spin" />
            <span>Loading WhatsApp templates...</span>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="border-border bg-card flex h-64 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
            <div className="bg-cf-orange/10 text-cf-orange mb-3 rounded-full p-3">
              <Layers className="size-6" />
            </div>
            <p className="text-foreground text-sm font-semibold">
              No templates found
            </p>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">
              {templates.length === 0
                ? "Click 'Sync with Meta' above to fetch your approved message templates from your WhatsApp Business Account."
                : "No templates matched your active filter or search criteria."}
            </p>
            {templates.length === 0 && (
              <button
                onClick={() => syncMutation.mutate()}
                className="bg-cf-orange mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#e87516]"
              >
                <RefreshCw className="size-3.5" />
                <span>Sync Templates Now</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template) => {
              const headerComp = template.components?.find(
                (c) => c.type === "HEADER"
              );
              const bodyComp = template.components?.find(
                (c) => c.type === "BODY"
              );
              const footerComp = template.components?.find(
                (c) => c.type === "FOOTER"
              );
              const buttonsComp = template.components?.find(
                (c) => c.type === "BUTTONS"
              );

              const isApproved = template.status === "APPROVED";

              return (
                <div
                  key={template.id}
                  className="border-border bg-card flex flex-col justify-between overflow-hidden rounded-xl border shadow-2xs transition-shadow hover:shadow-md"
                >
                  {/* Card Header */}
                  <div className="border-border bg-muted/20 space-y-2 border-b p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3
                          className="text-foreground truncate text-xs font-bold"
                          title={template.name}
                        >
                          {template.name}
                        </h3>
                        <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[10px]">
                          <span className="font-mono uppercase">
                            {template.language}
                          </span>
                          <span>•</span>
                          <span className="uppercase">{template.category}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isApproved ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" />
                          <span>Approved</span>
                        </span>
                      ) : template.status === "PENDING" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          <Clock className="size-3" />
                          <span>Pending</span>
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                          <XCircle className="size-3" />
                          <span>Rejected</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* WhatsApp Bubble Preview */}
                  <div className="flex-1 space-y-2.5 p-4">
                    <div className="border-cf-orange/30 space-y-2 rounded-lg border bg-amber-500/5 p-3 text-xs dark:bg-amber-500/10">
                      {/* Header Component */}
                      {headerComp && (
                        <div className="text-foreground border-border/50 border-b pb-1.5 text-[11px] font-semibold">
                          {headerComp.format === "TEXT" ? (
                            headerComp.text
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1">
                              [Media Header: {headerComp.format}]
                            </span>
                          )}
                        </div>
                      )}

                      {/* Body Component */}
                      {bodyComp && (
                        <p className="text-foreground text-[11px] leading-relaxed whitespace-pre-wrap">
                          {bodyComp.text}
                        </p>
                      )}

                      {/* Footer Component */}
                      {footerComp && (
                        <p className="text-muted-foreground border-border/40 border-t pt-1 text-[10px] italic">
                          {footerComp.text}
                        </p>
                      )}

                      {/* Buttons */}
                      {buttonsComp?.buttons &&
                        buttonsComp.buttons.length > 0 && (
                          <div className="border-border/40 space-y-1 border-t pt-2">
                            {buttonsComp.buttons.map((btn, idx) => (
                              <div
                                key={idx}
                                className="bg-card/80 text-cf-orange border-border flex items-center justify-center gap-1.5 rounded border px-2 py-1 text-[10px] font-medium"
                              >
                                {btn.type === "URL" ? (
                                  <ExternalLink className="size-2.5" />
                                ) : btn.type === "PHONE_NUMBER" ? (
                                  <Phone className="size-2.5" />
                                ) : (
                                  <MessageSquare className="size-2.5" />
                                )}
                                <span>{btn.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="border-border bg-muted/10 flex items-center justify-between gap-2 border-t p-3">
                    <span className="text-muted-foreground max-w-[150px] truncate font-mono text-[10px]">
                      ID: {template.metaTemplateId || template.id.slice(0, 8)}
                    </span>

                    {(() => {
                      const canSendCategory =
                        template.category === "MARKETING"
                          ? canSendMarketing
                          : canSendUtility;
                      const canSend = isApproved && canSendCategory;
                      return (
                        <button
                          disabled={!canSend}
                          onClick={() => {
                            setSelectedTemplateForSend(template);
                            setIsSendDialogOpen(true);
                          }}
                          className="bg-cf-orange inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs transition-colors hover:bg-[#e87516] disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            !isApproved
                              ? "Only approved templates can be sent"
                              : !canSendCategory
                                ? `You do not have permission to send ${template.category.toLowerCase()} templates`
                                : "Send to a customer"
                          }
                        >
                          <Send className="size-3" />
                          <span>Send Template</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Send Template Dialog */}
      {isSendDialogOpen && selectedTemplateForSend && (
        <SendTemplateDialog
          isOpen={isSendDialogOpen}
          onClose={() => {
            setIsSendDialogOpen(false);
            setSelectedTemplateForSend(null);
          }}
          customer={customers[0] || null}
          initialTemplateId={selectedTemplateForSend.id}
          templates={templates}
          onSent={() => {
            setIsSendDialogOpen(false);
            setSelectedTemplateForSend(null);
            toast.success("Template sent successfully");
          }}
        />
      )}
    </div>
  );
}
