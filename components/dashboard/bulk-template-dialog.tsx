"use client";

import type {
  DashboardCustomer,
  DashboardTemplate,
  DashboardGroup
} from "./types";
import {
  Layers,
  Loader2,
  X,
  Search,
  Check,
  Users,
  CheckSquare,
  Building2,
  Sparkles,
  Pin,
  ChevronDown,
  Image as ImageIcon,
  Video,
  FileText,
  Link as LinkIcon,
  ExternalLink
} from "lucide-react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import React, { useState, useMemo, useEffect } from "react";
import { formatDisplayPhone } from "@/utils/phone";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { toast } from "sonner";

export interface BulkVariableConfig {
  type: "static" | "dynamic";
  field: string;
  staticValue: string;
  fallback: string;
}

const CRM_FIELDS = [
  { key: "customer.name", label: "Contact Name (Full / Display)" },
  { key: "customer.customName", label: "Custom CRM Name" },
  { key: "customer.phoneNumber", label: "Recipient Phone Number" },
  { key: "customer.whatsappName", label: "WhatsApp Profile Name" },
  { key: "customer.notes", label: "Staff Notes" },
  { key: "customer.about", label: "WhatsApp About" }
];

interface BulkTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomers?: DashboardCustomer[];
  templates: DashboardTemplate[];
  initialTemplateId?: string;
  onStarted: () => void;
}

export function BulkTemplateDialog({
  isOpen,
  onClose,
  selectedCustomers = [],
  templates,
  initialTemplateId,
  onStarted
}: BulkTemplateDialogProps) {
  const { hasPermission, isOwner, user } = useAuth();
  const canBulkUtility =
    isOwner || hasPermission(PERMISSIONS.BULK_UTILITY_SEND);
  const canBulkMarketing =
    isOwner || hasPermission(PERMISSIONS.BULK_MARKETING_SEND);

  // 1. Tab state: "ALL" vs "CUSTOM" vs "GROUPS"
  const [activeTab, setActiveTab] = useState<"ALL" | "CUSTOM" | "GROUPS">(
    "ALL"
  );

  // 2. Filter approved templates
  const approvedTemplates = useMemo(() => {
    return templates.filter((t) => {
      const isApprovedOrPending =
        t.status === "APPROVED" || t.status === "PENDING";
      if (!isApprovedOrPending) return false;

      if (t.category === "MARKETING") return canBulkMarketing;
      if (t.category === "UTILITY") return canBulkUtility;
      return canBulkUtility || canBulkMarketing;
    });
  }, [templates, canBulkMarketing, canBulkUtility]);

  const defaultTemplateId = useMemo(() => {
    if (initialTemplateId) return initialTemplateId;
    return approvedTemplates.length > 0 ? approvedTemplates[0].id : "";
  }, [initialTemplateId, approvedTemplates]);

  // Template and variable states
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customConfigs, setCustomConfigs] = useState<
    Record<string, BulkVariableConfig>
  >({});
  const [allowOverride, setAllowOverride] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Media header states
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string>("");
  const [customMediaUrl, setCustomMediaUrl] = useState<string>("");
  const [isCustomMedia, setIsCustomMedia] = useState<boolean>(false);
  const [selectedMediaTitle, setSelectedMediaTitle] = useState<string>("");

  // Custom contact search & selection state (Tab 2)
  const [customSearch, setCustomSearch] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => {
    return new Set(selectedCustomers.map((c) => c.id));
  });

  // Groups selection state (Tab 3)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set()
  );
  const [groupSearch, setGroupSearch] = useState("");

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

  const activeTemplateId = selectedTemplateId || defaultTemplateId;

  const selectedTemplate = useMemo(() => {
    return approvedTemplates.find((t) => t.id === activeTemplateId);
  }, [approvedTemplates, activeTemplateId]);

  const bodyComponent = useMemo(() => {
    return selectedTemplate?.components.find(
      (c) => String(c.type).toUpperCase() === "BODY"
    );
  }, [selectedTemplate]);

  const rawHeaderComponent = useMemo(() => {
    return selectedTemplate?.components.find(
      (c) => String(c.type).toUpperCase() === "HEADER"
    );
  }, [selectedTemplate]);

  const isMediaHeader = useMemo(() => {
    const fmt = rawHeaderComponent?.format?.toUpperCase() || "";
    return ["IMAGE", "VIDEO", "DOCUMENT"].includes(fmt);
  }, [rawHeaderComponent]);

  const mediaFormat = useMemo(() => {
    return (rawHeaderComponent?.format?.toUpperCase() || "IMAGE") as
      | "IMAGE"
      | "VIDEO"
      | "DOCUMENT";
  }, [rawHeaderComponent]);

  const configuredMediaLinks = useMemo(() => {
    if (!rawHeaderComponent) return [];
    const ex = rawHeaderComponent.examples as Record<string, unknown> | null;
    const raw = (rawHeaderComponent as unknown as Record<string, unknown>)
      ?.rawJson as Record<string, unknown> | null;
    const links = (ex?.mediaLinks || raw?.mediaLinks) as
      | Array<{
          id?: string;
          url: string;
          title?: string;
          type?: string;
          isDefault?: boolean;
        }>
      | undefined;
    return links || [];
  }, [rawHeaderComponent]);

  const headerComponent = useMemo(() => {
    if (isMediaHeader) return null;
    return rawHeaderComponent;
  }, [isMediaHeader, rawHeaderComponent]);

  useEffect(() => {
    if (isMediaHeader) {
      if (configuredMediaLinks.length > 0) {
        const def =
          configuredMediaLinks.find((l) => l.isDefault) ||
          configuredMediaLinks[0];
        setSelectedMediaUrl(def.url);
        setSelectedMediaTitle(def.title || "");
        setIsCustomMedia(false);
        setCustomMediaUrl("");
      } else {
        setSelectedMediaUrl("");
        setSelectedMediaTitle("");
        setIsCustomMedia(true);
        setCustomMediaUrl("");
      }
    } else {
      setSelectedMediaUrl("");
      setSelectedMediaTitle("");
      setIsCustomMedia(false);
      setCustomMediaUrl("");
    }
  }, [isMediaHeader, configuredMediaLinks]);

  const activeMediaUrl = useMemo(() => {
    return isCustomMedia ? customMediaUrl.trim() : selectedMediaUrl.trim();
  }, [isCustomMedia, customMediaUrl, selectedMediaUrl]);

  const bodyText = bodyComponent?.text || "";
  const headerText = headerComponent?.text || "";

  // Extract variables
  const bodyVarKeys = useMemo(() => {
    const matches = Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g));
    const keys = Array.from(new Set(matches.map((m) => m[1])));
    return keys.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [bodyText]);

  const headerVarKeys = useMemo(() => {
    const matches = Array.from(headerText.matchAll(/\{\{(\d+)\}\}/g));
    return Array.from(new Set(matches.map((m) => `header_${m[1]}`)));
  }, [headerText]);

  const allVarKeys = useMemo(() => {
    return [...headerVarKeys, ...bodyVarKeys];
  }, [headerVarKeys, bodyVarKeys]);

  // Query audience statistics for Tab 1 ("All Contacts")
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

  // Infinite query for Tab 2 ("Custom Selection")
  const {
    data: customCustomersPages,
    isLoading: isLoadingCustomList,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ["bulk-custom-customers", customSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const q = encodeURIComponent(customSearch.trim());
      const res = await fetch(
        `/api/customers?page=${pageParam}&limit=50${q ? `&search=${q}` : ""}`
      );
      const json = await res.json();
      if (!res.ok || json.error) {
        return {
          customers: [],
          pagination: { total: 0, totalPages: 1, page: 1 }
        };
      }
      return json.data as {
        customers: DashboardCustomer[];
        pagination: { total: number; totalPages: number; page: number };
      };
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pagination) return undefined;
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: isOpen && activeTab === "CUSTOM"
  });

  const allLoadedCustomCustomers = useMemo(() => {
    if (!customCustomersPages?.pages) return selectedCustomers;
    const items: DashboardCustomer[] = [];
    for (const page of customCustomersPages.pages) {
      if (Array.isArray(page.customers)) {
        items.push(...page.customers);
      }
    }
    return items;
  }, [customCustomersPages, selectedCustomers]);

  // Compute default configs derived purely via useMemo
  const defaultConfigs = useMemo(() => {
    const configs: Record<string, BulkVariableConfig> = {};
    if (!selectedTemplate) return configs;

    const bComp = selectedTemplate.components.find(
      (c) => String(c.type).toUpperCase() === "BODY"
    );
    const hComp = selectedTemplate.components.find(
      (c) =>
        String(c.type).toUpperCase() === "HEADER" &&
        (!c.format || c.format.toUpperCase() === "TEXT")
    );

    const bMappings =
      ((bComp?.examples as Record<string, unknown>)?.variableMappings as Record<
        string,
        {
          type?: "static" | "dynamic";
          field?: string;
          customField?: string;
          staticValue?: string;
          fallback?: string;
          sample?: string;
        }
      >) ||
      (
        (bComp as unknown as Record<string, unknown>)?.rawJson as {
          variableMappings?: Record<string, unknown>;
        }
      )?.variableMappings ||
      {};

    const hMapping =
      ((hComp?.examples as Record<string, unknown>)?.variableMapping as Record<
        string,
        unknown
      >) ||
      (
        (hComp as unknown as Record<string, unknown>)?.rawJson as {
          variableMapping?: Record<string, unknown>;
        }
      )?.variableMapping;

    for (const hk of headerVarKeys) {
      if (hMapping) {
        configs[hk] = {
          type: (hMapping.type as "static" | "dynamic") || "static",
          field: (hMapping.field as string) || "customer.customName",
          staticValue:
            (hMapping.staticValue as string) ||
            (hMapping.sample as string) ||
            "",
          fallback: (hMapping.fallback as string) || "Customer"
        };
      } else {
        configs[hk] = {
          type: "static",
          field: "customer.customName",
          staticValue: "",
          fallback: "Customer"
        };
      }
    }

    const lowerBody = (bComp?.text || "").toLowerCase();
    for (const bk of bodyVarKeys) {
      const raw = bMappings[bk] as
        | {
            type?: "static" | "dynamic";
            field?: string;
            customField?: string;
            staticValue?: string;
            fallback?: string;
            sample?: string;
          }
        | undefined;

      if (raw) {
        configs[bk] = {
          type: raw.type || "dynamic",
          field:
            raw.field === "custom" && raw.customField
              ? raw.customField
              : raw.field || "customer.name",
          staticValue: raw.staticValue || raw.sample || "",
          fallback: raw.fallback || "Customer"
        };
      } else {
        const pattern = new RegExp(`([^.!?\\n]{0,35})\\{\\{${bk}\\}\\}`, "i");
        const match = lowerBody.match(pattern);
        const preceding = match ? match[1] : "";

        if (
          preceding.includes("custom name") ||
          preceding.includes("custom_name")
        ) {
          configs[bk] = {
            type: "dynamic",
            field: "customer.customName",
            staticValue: "",
            fallback: "Customer"
          };
        } else if (
          preceding.includes("number") ||
          preceding.includes("phone") ||
          preceding.includes("mobile") ||
          preceding.includes("contact")
        ) {
          configs[bk] = {
            type: "dynamic",
            field: "customer.phoneNumber",
            staticValue: "",
            fallback: ""
          };
        } else if (
          preceding.includes("dear") ||
          preceding.includes("hi") ||
          preceding.includes("hello") ||
          preceding.includes("name")
        ) {
          configs[bk] = {
            type: "dynamic",
            field: "customer.name",
            staticValue: "",
            fallback: "Customer"
          };
        } else if (bk === "1") {
          configs[bk] = {
            type: "dynamic",
            field: "customer.name",
            staticValue: "",
            fallback: "Customer"
          };
        } else if (bk === "2") {
          configs[bk] = {
            type: "dynamic",
            field: "customer.phoneNumber",
            staticValue: "",
            fallback: ""
          };
        } else if (bk === "3") {
          configs[bk] = {
            type: "dynamic",
            field: "customer.customName",
            staticValue: "",
            fallback: "Customer"
          };
        } else {
          configs[bk] = {
            type: "static",
            field: "customer.customName",
            staticValue: "",
            fallback: "Customer"
          };
        }
      }
    }

    return configs;
  }, [selectedTemplate, headerVarKeys, bodyVarKeys]);

  const effectiveConfigs = useMemo(() => {
    return { ...defaultConfigs, ...customConfigs };
  }, [defaultConfigs, customConfigs]);

  // Audience counts calculation
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
    const checkedCustomers = allLoadedCustomCustomers.filter((c) =>
      checkedIds.has(c.id)
    );
    if (allowOverride) {
      return checkedCustomers.length;
    }
    return checkedCustomers.filter((c) => c.state === "ACTIVE").length;
  }, [
    activeTab,
    allowOverride,
    totalAudience,
    activeAudience,
    allLoadedCustomCustomers,
    checkedIds,
    groups,
    selectedGroupIds
  ]);

  // Live rendered previews for bulk
  const renderedHeaderText = useMemo(() => {
    if (!headerText) return null;
    let text = headerText;
    for (const k of headerVarKeys) {
      const rawNum = k.replace(/^header_/, "");
      const cfg = effectiveConfigs[k];
      let val = `{{${rawNum}}}`;
      if (cfg) {
        val =
          cfg.type === "static"
            ? cfg.staticValue || `[Static: {{${rawNum}}}]`
            : `[${cfg.field.replace("customer.", "").toUpperCase()}]`;
      }
      text = text.replace(new RegExp(`\\{\\{${rawNum}\\}\\}`, "g"), val);
    }
    return text;
  }, [headerText, headerVarKeys, effectiveConfigs]);

  const renderedBodyText = useMemo(() => {
    if (!bodyText) return "";
    let text = bodyText;
    for (const k of bodyVarKeys) {
      const cfg = effectiveConfigs[k];
      let val = `{{${k}}}`;
      if (cfg) {
        val =
          cfg.type === "static"
            ? cfg.staticValue || `[Static: {{${k}}}]`
            : `[${cfg.field.replace("customer.", "").toUpperCase()}]`;
      }
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), val);
    }
    return text;
  }, [bodyText, bodyVarKeys, effectiveConfigs]);

  // Early return placed AFTER all hooks
  if (!isOpen) return null;

  function handleSelectTemplate(id: string) {
    setSelectedTemplateId(id);
    setCustomConfigs({});
  }

  function handleConfigChange(
    key: string,
    updates: Partial<BulkVariableConfig>
  ) {
    const current = effectiveConfigs[key] || {
      type: "dynamic",
      field: "customer.name",
      staticValue: "",
      fallback: "Customer"
    };
    setCustomConfigs((prev) => ({
      ...prev,
      [key]: { ...current, ...updates }
    }));
  }

  function toggleContact(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllLoaded() {
    setCheckedIds(new Set(allLoadedCustomCustomers.map((c) => c.id)));
  }

  function deselectAll() {
    setCheckedIds(new Set());
  }

  async function handleConfirm() {
    if (eligibleCount === 0) {
      toast.error("No eligible recipients available for this broadcast");
      return;
    }
    if (!selectedTemplate) {
      toast.error("Please select an approved template");
      return;
    }

    if (activeTab === "GROUPS" && selectedGroupIds.size === 0) {
      toast.error("Please select at least one group for broadcast");
      return;
    }

    // Validate static variables
    for (const k of allVarKeys) {
      const cfg = effectiveConfigs[k];
      const isHeader = k.startsWith("header_");
      const displayLabel = isHeader
        ? `Header {{${k.replace(/^header_/, "")}}}`
        : `{{${k}}}`;

      if (cfg?.type === "static" && !cfg.staticValue?.trim()) {
        toast.error(`Please provide static text for variable ${displayLabel}`);
        return;
      }
    }

    if (isMediaHeader) {
      if (!activeMediaUrl) {
        toast.error(
          `Please provide or select a media link for the ${mediaFormat.toLowerCase()} header`
        );
        return;
      }
      if (!/^https?:\/\//i.test(activeMediaUrl)) {
        toast.error("Media link must start with http:// or https://");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const components: Array<{
        type: string;
        parameters: Array<{ type: string; text: string }>;
      }> = [];

      if (isMediaHeader && activeMediaUrl) {
        const fmt = mediaFormat.toLowerCase();
        components.push({
          type: "header",
          parameters: [
            {
              type: fmt,
              [fmt]: {
                link: activeMediaUrl,
                ...(fmt === "document"
                  ? { filename: selectedMediaTitle || "Document.pdf" }
                  : {})
              }
            } as unknown as { type: string; text: string }
          ]
        });
      }

      if (headerVarKeys.length > 0) {
        const hParams = headerVarKeys.map((k) => {
          const cfg = effectiveConfigs[k];
          const text =
            cfg?.type === "static"
              ? cfg.staticValue
              : `{{${cfg?.field || "customer.customName"}}}`;
          return { type: "text", text };
        });
        components.push({ type: "header", parameters: hParams });
      }

      if (bodyVarKeys.length > 0) {
        const bParams = bodyVarKeys.map((k) => {
          const cfg = effectiveConfigs[k];
          const text =
            cfg?.type === "static"
              ? cfg.staticValue
              : `{{${cfg?.field || "customer.name"}}}`;
          return { type: "text", text };
        });
        components.push({ type: "body", parameters: bParams });
      }

      const res = await fetch("/api/bulk/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          language: selectedTemplate.language || "en",
          targetMode: activeTab,
          customerIds:
            activeTab === "CUSTOM" ? Array.from(checkedIds) : undefined,
          groupIds:
            activeTab === "GROUPS" ? Array.from(selectedGroupIds) : undefined,
          variableConfigurations: effectiveConfigs,
          components,
          allowOverrideBlocked: allowOverride
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(
          json.message || "Failed to initiate template broadcast"
        );
      }

      toast.success(
        `Template broadcast initiated for ${eligibleCount} customers!`
      );
      onStarted();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to broadcast template";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 duration-150">
      <div className="border-border bg-card flex max-h-[92vh] w-full max-w-xl flex-col rounded-lg border p-5 text-xs shadow-2xl">
        {/* Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b pb-3">
          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <Layers className="text-cf-orange size-4" />
            <span>Send Bulk WhatsApp Template</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
          {/* Target Audience Tabs */}
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

            {/* TAB 1: ALL CONTACTS */}
            {activeTab === "ALL" && (
              <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-foreground text-xs font-semibold">
                      {statsData?.scopedToStaff
                        ? `Staff Scope: Assigned to ${statsData.staffName || user.name}`
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

                {/* Counts Breakdown */}
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
                      id="bulk-all-override"
                      checked={allowOverride}
                      onChange={(e) => setAllowOverride(e.target.checked)}
                      className="accent-cf-orange cursor-pointer rounded"
                    />
                    <label
                      htmlFor="bulk-all-override"
                      className="text-muted-foreground cursor-pointer"
                    >
                      Override: Include blocked / opted-out contacts (
                      {totalAudience} total)
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CUSTOM SELECTION */}
            {activeTab === "CUSTOM" && (
              <div className="border-border bg-muted/20 space-y-2.5 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-xs font-semibold">
                    Select Customers ({checkedIds.size} selected)
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllLoaded}
                      className="text-cf-orange cursor-pointer hover:underline"
                    >
                      Select All Loaded
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customSearch}
                    onChange={(e) => setCustomSearch(e.target.value)}
                    placeholder="Search by name or phone (infinite scroll)..."
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded border py-1.5 pr-2.5 pl-7 text-xs focus:outline-none"
                  />
                </div>

                {/* Customer List */}
                <div className="border-border bg-background divide-border/60 max-h-40 divide-y overflow-y-auto rounded border">
                  {isLoadingCustomList ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="text-cf-orange size-4 animate-spin" />
                    </div>
                  ) : allLoadedCustomCustomers.length === 0 ? (
                    <div className="text-muted-foreground p-3 text-center text-[11px]">
                      No matching contacts found
                    </div>
                  ) : (
                    allLoadedCustomCustomers.map((cust) => {
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
                                <Check className="size-2.5 stroke-3" />
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

                  {hasNextPage && (
                    <div className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="text-cf-orange inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium hover:underline"
                      >
                        {isFetchingNextPage ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )}
                        <span>Load more contacts...</span>
                      </button>
                    </div>
                  )}
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
                      Clear Selection
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
                  <input
                    type="text"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Search groups by name..."
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded border py-1.5 pr-2.5 pl-7 text-xs focus:outline-none"
                  />
                </div>

                {/* Groups List */}
                <div className="border-border bg-background divide-border/60 max-h-48 divide-y overflow-y-auto rounded border">
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
                          className={`flex cursor-pointer items-center justify-between px-2.5 py-2 transition-colors select-none ${
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
                                <Check className="size-2.5 stroke-3" />
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

                {/* Recipient summary */}
                <div className="text-muted-foreground flex items-center justify-between pt-1 text-[11px]">
                  <span>
                    Total Groups: <strong>{selectedGroupIds.size}</strong>
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

          {/* Template Selector */}
          <div className="space-y-1.5">
            <label className="text-foreground font-semibold">
              Select Approved Template
            </label>
            <select
              value={activeTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
            >
              <option value="">-- Choose a template --</option>
              {approvedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.language.toUpperCase()}) - {t.category}
                </option>
              ))}
            </select>
          </div>

          {/* Media Header Selection Section */}
          {selectedTemplate && isMediaHeader && (
            <div className="border-border bg-muted/15 space-y-3 rounded-lg border p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-foreground flex items-center gap-1.5 font-semibold">
                  {mediaFormat === "IMAGE" ? (
                    <ImageIcon className="text-cf-orange size-3.5" />
                  ) : mediaFormat === "VIDEO" ? (
                    <Video className="text-cf-orange size-3.5" />
                  ) : (
                    <FileText className="text-cf-orange size-3.5" />
                  )}
                  <span>
                    Header Media (
                    {mediaFormat === "IMAGE"
                      ? "Image Banner"
                      : mediaFormat === "VIDEO"
                        ? "Video Media"
                        : "Document / PDF"}
                    )
                  </span>
                </label>
                <span className="bg-cf-orange/10 text-cf-orange rounded-full px-2 py-0.5 text-[10px] font-bold">
                  Direct Link • No Upload
                </span>
              </div>

              {configuredMediaLinks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-[11px]">
                    Choose from template preset media links or enter a custom broadcast link:
                  </p>
                  <div className="space-y-1.5">
                    {configuredMediaLinks.map((link, idx) => {
                      const isSelected =
                        !isCustomMedia && selectedMediaUrl === link.url;
                      return (
                        <div
                          key={link.id || idx}
                          onClick={() => {
                            setIsCustomMedia(false);
                            setSelectedMediaUrl(link.url);
                            setSelectedMediaTitle(link.title || "");
                          }}
                          className={`flex cursor-pointer items-center justify-between rounded-md border p-2.5 transition-colors ${
                            isSelected
                              ? "border-cf-orange bg-cf-orange/10 text-foreground"
                              : "border-border bg-background hover:bg-muted/50 text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="radio"
                              name="bulkHeaderMediaPreset"
                              checked={isSelected}
                              onChange={() => {}}
                              className="accent-cf-orange"
                            />
                            <div className="min-w-0">
                              <p className="text-foreground text-xs font-semibold truncate">
                                {link.title || `Media Preset #${idx + 1}`}
                                {link.isDefault ? " (⭐ Default)" : ""}
                              </p>
                              <p className="text-muted-foreground text-[10px] truncate max-w-[280px]">
                                {link.url}
                              </p>
                            </div>
                          </div>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={(e) => e.stopPropagation()}
                            className="text-cf-orange hover:bg-cf-orange/10 shrink-0 rounded p-1 transition-colors"
                            title="Open link in new tab"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                      );
                    })}

                    <div
                      onClick={() => setIsCustomMedia(true)}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 transition-colors ${
                        isCustomMedia
                          ? "border-cf-orange bg-cf-orange/10 text-foreground"
                          : "border-border bg-background hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <input
                        type="radio"
                        name="bulkHeaderMediaPreset"
                        checked={isCustomMedia}
                        onChange={() => {}}
                        className="accent-cf-orange"
                      />
                      <span className="text-xs font-medium">
                        Custom Direct Media Link for Broadcast...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Media URL Input */}
              {(isCustomMedia || configuredMediaLinks.length === 0) && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-muted-foreground text-[10px] font-semibold uppercase flex items-center justify-between">
                    <span>Broadcast Direct Media URL (HTTPS) *</span>
                    {activeMediaUrl && /^https?:\/\//i.test(activeMediaUrl) && (
                      <a
                        href={activeMediaUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-cf-orange inline-flex items-center gap-0.5 lowercase hover:underline"
                      >
                        <span>Test link</span>
                        <ExternalLink className="size-2.5" />
                      </a>
                    )}
                  </label>
                  <div className="relative">
                    <LinkIcon className="text-muted-foreground absolute left-2.5 top-2.5 size-3.5" />
                    <input
                      type="url"
                      value={customMediaUrl}
                      onChange={(e) => {
                        setIsCustomMedia(true);
                        setCustomMediaUrl(e.target.value);
                      }}
                      placeholder={
                        mediaFormat === "IMAGE"
                          ? "https://example.com/broadcast-banner.jpg"
                          : mediaFormat === "VIDEO"
                            ? "https://example.com/broadcast-video.mp4"
                            : "https://example.com/broadcast-brochure.pdf"
                      }
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded border py-1.5 pl-8 pr-2 text-xs focus:ring-1 focus:outline-none"
                    />
                  </div>
                  {mediaFormat === "DOCUMENT" && (
                    <div className="space-y-1 pt-1">
                      <label className="text-muted-foreground text-[10px] font-semibold uppercase">
                        Document Display Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={selectedMediaTitle}
                        onChange={(e) => setSelectedMediaTitle(e.target.value)}
                        placeholder="e.g. Brochure.pdf"
                        className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded border px-2.5 py-1 text-xs focus:ring-1 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Variables Configuration (Static vs Dynamic) */}
          {allVarKeys.length > 0 && (
            <div className="border-border bg-muted/15 space-y-3 rounded-lg border p-3.5">
              <div className="flex items-center justify-between">
                <label className="text-foreground flex items-center gap-1.5 font-semibold">
                  <Sparkles className="text-cf-orange size-3.5" />
                  <span>Configure Variables (Static or Dynamic)</span>
                </label>
                <span className="text-muted-foreground text-[11px]">
                  {allVarKeys.length} wildcard{allVarKeys.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-3">
                {allVarKeys.map((k) => {
                  const isHeader = k.startsWith("header_");
                  const displayLabel = isHeader
                    ? `Header {{${k.replace(/^header_/, "")}}}`
                    : `Variable {{${k}}}`;
                  const config = effectiveConfigs[k] || {
                    type: "dynamic",
                    field: "customer.name",
                    staticValue: "",
                    fallback: "Customer"
                  };

                  return (
                    <div
                      key={k}
                      className="border-border bg-background space-y-2 rounded-md border p-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-foreground font-mono text-[11px] font-semibold">
                          {displayLabel}
                        </span>

                        {/* Static vs Dynamic Pill */}
                        <div className="bg-muted inline-flex rounded p-0.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() =>
                              handleConfigChange(k, { type: "static" })
                            }
                            className={`cursor-pointer rounded px-2.5 py-0.5 font-medium transition-colors ${
                              config.type === "static"
                                ? "bg-background text-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <Pin className="size-2.5" />
                              📌 Static Text
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleConfigChange(k, { type: "dynamic" })
                            }
                            className={`cursor-pointer rounded px-2.5 py-0.5 font-medium transition-colors ${
                              config.type === "dynamic"
                                ? "bg-background text-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            ⚡ Dynamic CRM Field
                          </button>
                        </div>
                      </div>

                      {config.type === "static" ? (
                        <div className="space-y-1">
                          <label className="text-muted-foreground text-[10px] font-medium">
                            Enter Static Value on Modal (applied to all
                            recipients)
                          </label>
                          <input
                            type="text"
                            required
                            value={config.staticValue}
                            onChange={(e) =>
                              handleConfigChange(k, {
                                staticValue: e.target.value
                              })
                            }
                            placeholder={`Enter static value for ${displayLabel} (e.g. Annual Day 2026, 20% OFF)...`}
                            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded border px-2.5 py-1 text-xs focus:ring-1 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <label className="text-muted-foreground text-[10px]">
                                Recipient CRM Attribute
                              </label>
                              <select
                                value={config.field}
                                onChange={(e) =>
                                  handleConfigChange(k, {
                                    field: e.target.value
                                  })
                                }
                                className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
                              >
                                {CRM_FIELDS.map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {f.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-muted-foreground text-[10px]">
                                Fallback (if contact field is blank)
                              </label>
                              <input
                                type="text"
                                value={config.fallback}
                                onChange={(e) =>
                                  handleConfigChange(k, {
                                    fallback: e.target.value
                                  })
                                }
                                placeholder="e.g. Customer, Parent..."
                                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded border px-2.5 py-1 text-xs focus:ring-1 focus:outline-none"
                              />
                            </div>
                          </div>
                          <p className="text-muted-foreground text-[10px]">
                            ⚡ Injected dynamically for each recipient during
                            dispatch.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Preview */}
          {selectedTemplate && (
            <div className="space-y-1.5">
              <label className="text-foreground font-semibold">
                Broadcast Live Preview
              </label>
              <div className="border-border bg-accent/30 text-foreground space-y-2 rounded-lg border p-3 text-xs leading-relaxed">
                {isMediaHeader && activeMediaUrl && (
                  <div className="border-border/60 border-b pb-2">
                    {mediaFormat === "IMAGE" && (
                      <div className="overflow-hidden rounded border border-border/80 bg-black/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeMediaUrl}
                          alt="Header Preview"
                          className="max-h-36 w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display =
                              "none";
                          }}
                        />
                      </div>
                    )}
                    {mediaFormat === "VIDEO" && (
                      <div className="overflow-hidden rounded border border-border/80 bg-black">
                        <video
                          src={activeMediaUrl}
                          controls
                          className="max-h-36 w-full object-contain"
                        />
                      </div>
                    )}
                    {mediaFormat === "DOCUMENT" && (
                      <div className="bg-background flex items-center justify-between rounded border border-border p-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="text-red-500 size-4 shrink-0" />
                          <span className="truncate text-[11px] font-medium">
                            {selectedMediaTitle || "Document_Attachment.pdf"}
                          </span>
                        </div>
                        <a
                          href={activeMediaUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-cf-orange hover:bg-cf-orange/10 shrink-0 rounded p-1"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}
                {renderedHeaderText && (
                  <div className="text-foreground border-border/60 border-b pb-1 text-xs font-semibold">
                    {renderedHeaderText}
                  </div>
                )}
                <div className="font-sans text-xs whitespace-pre-wrap">
                  {renderedBodyText}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-border flex shrink-0 items-center justify-between border-t pt-3">
          <div className="text-muted-foreground text-[11px]">
            Targeting:{" "}
            <strong className="text-foreground font-semibold">
              {eligibleCount}
            </strong>{" "}
            recipients
          </div>

          <div className="flex gap-2">
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
              disabled={
                !selectedTemplate || eligibleCount === 0 || isSubmitting
              }
              className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516] disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Layers className="size-3.5" />
              )}
              <span>Broadcast to {eligibleCount} recipients</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
