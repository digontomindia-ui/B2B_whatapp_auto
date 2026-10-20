"use client";

import {
  Wallet,
  ExternalLink,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  AlertCircle,
  Search,
  BarChart3,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  Info,
  Pencil,
  X
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import type {
  FundsSummary,
  LiveTransaction,
  TemplateAnalyticItem
} from "@/server/funds/service";

interface FundsApiResponse {
  error: boolean;
  message: string;
  data: {
    summary: FundsSummary;
    transactions: LiveTransaction[];
    templateAnalytics: TemplateAnalyticItem[];
  };
}

export default function FundsPage() {
  const [activeTab, setActiveTab] = useState<"analytics" | "transactions">(
    "analytics"
  );
  const [copiedWaba, setCopiedWaba] = useState(false);

  // Filters for Transactions
  const [txTypeFilter, setTxTypeFilter] = useState<"ALL" | "CREDIT" | "DEBIT">(
    "ALL"
  );
  const [txSearch, setTxSearch] = useState("");

  // Filters for Template Analytics
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<
    "ALL" | "MARKETING" | "UTILITY" | "AUTHENTICATION"
  >("ALL");

  const { data, isLoading, isError, error, isFetching, refetch } =
    useQuery<FundsApiResponse>({
      queryKey: ["fundsData"],
      queryFn: async () => {
        const res = await fetch("/api/funds");
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.message || "Failed to load funds data");
        }
        return res.json();
      },
      refetchInterval: 30000 // auto-refresh every 30 seconds
    });

  const summary = data?.data?.summary;
  const transactions = useMemo(
    () => data?.data?.transactions || [],
    [data?.data?.transactions]
  );
  const templateAnalytics = useMemo(
    () => data?.data?.templateAnalytics || [],
    [data?.data?.templateAnalytics]
  );

  // Copy WABA ID helper
  function handleCopyWaba() {
    if (!summary?.wabaId) return;
    navigator.clipboard.writeText(summary.wabaId);
    setCopiedWaba(true);
    toast.success("WABA ID copied to clipboard");
    setTimeout(() => setCopiedWaba(false), 2000);
  }

  // Edit WhatsApp Account Balance helper
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [newBalanceInput, setNewBalanceInput] = useState("");
  const [isSavingBalance, setIsSavingBalance] = useState(false);

  async function handleSaveBalance() {
    const num = parseFloat(newBalanceInput);
    if (isNaN(num) || num < 0) {
      toast.error("Please enter a valid positive number for balance");
      return;
    }
    try {
      setIsSavingBalance(true);
      const res = await fetch("/api/funds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance: num })
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to update balance");
      }
      toast.success(json.message || "Balance updated successfully");
      setIsEditingBalance(false);
      refetch();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update balance"
      );
    } finally {
      setIsSavingBalance(false);
    }
  }

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (txTypeFilter !== "ALL" && tx.type !== txTypeFilter) return false;
      if (txSearch.trim()) {
        const query = txSearch.toLowerCase();
        const matchDesc = tx.description.toLowerCase().includes(query);
        const matchId = tx.id.toLowerCase().includes(query);
        const matchRef = (tx.reference || "").toLowerCase().includes(query);
        return matchDesc || matchId || matchRef;
      }
      return true;
    });
  }, [transactions, txTypeFilter, txSearch]);

  // Filtered template analytics
  const filteredTemplates = useMemo(() => {
    return templateAnalytics.filter((tmpl) => {
      if (
        templateCategoryFilter !== "ALL" &&
        tmpl.category !== templateCategoryFilter
      ) {
        return false;
      }
      if (templateSearch.trim()) {
        const query = templateSearch.toLowerCase();
        return tmpl.name.toLowerCase().includes(query);
      }
      return true;
    });
  }, [templateAnalytics, templateCategoryFilter, templateSearch]);

  const currencySymbol = summary?.currencySymbol || "₹";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Top Header / Breadcrumb Bar */}
      <div className="border-border bg-card/60 sticky top-0 z-20 border-b px-6 py-4 backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-cf-orange/15 text-cf-orange rounded-lg p-2">
                <Wallet className="size-5" />
              </div>
              <div>
                <h1 className="text-foreground text-lg font-bold tracking-tight">
                  Funds &amp; Account Balance
                </h1>
                <p className="text-muted-foreground text-xs">
                  WhatsApp Business Account wallet balance, live transactions,
                  and per-template analytics.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Refresh Button */}
            <button
              onClick={() => {
                refetch();
                toast.info("Refreshed live funds data");
              }}
              disabled={isFetching}
              className="border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-2xs transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`size-3.5 ${isFetching ? "text-cf-orange animate-spin" : ""}`}
              />
              <span>{isFetching ? "Syncing..." : "Sync Live"}</span>
            </button>

            {/* Primary Add Funds in WhatsApp Manager Button */}
            <a
              href={
                summary?.addFundsUrl ||
                "https://business.facebook.com/latest/whatsapp_manager/overview?business_id=1123162246252430&asset_id=1172496625076498"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="bg-cf-orange shadow-cf-orange/20 inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-[#e87516] active:scale-[0.98]"
            >
              <span>Add Funds (WhatsApp Manager)</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {/* Loading / Error States */}
        {isLoading && (
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-12 text-center">
            <RefreshCw className="text-cf-orange size-8 animate-spin" />
            <p className="text-foreground mt-3 text-sm font-semibold">
              Loading WhatsApp Funds &amp; Analytics...
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Connecting to Meta Graph API &amp; calculating live metrics
            </p>
          </div>
        )}

        {isError && (
          <div className="border-destructive/30 bg-destructive/5 rounded-xl border p-4 text-xs">
            <div className="text-destructive flex items-center gap-2 font-semibold">
              <AlertCircle className="size-4" />
              <span>Could not load funds data</span>
            </div>
            <p className="text-muted-foreground mt-1">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        )}

        {summary && (
          <>
            {/* Top 4 KPI Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Available Balance */}
              <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Available Funds Left
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-500"></span>
                    {summary.accountHealth}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between gap-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-muted-foreground text-xl font-semibold">
                      {currencySymbol}
                    </span>
                    <span className="text-foreground font-mono text-3xl font-extrabold tracking-tight">
                      {summary.balance.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setNewBalanceInput(String(summary.balance));
                      setIsEditingBalance(!isEditingBalance);
                    }}
                    title="Update WhatsApp Account Balance"
                    className="border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium shadow-2xs transition-colors"
                  >
                    <Pencil className="size-3" />
                    <span>Edit</span>
                  </button>
                </div>

                {isEditingBalance && (
                  <div className="border-border bg-muted/40 mt-3 rounded-lg border p-2.5">
                    <div className="text-muted-foreground mb-1.5 text-[11px] font-medium">
                      Set WhatsApp Wallet Balance ({currencySymbol}):
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newBalanceInput}
                        onChange={(e) => setNewBalanceInput(e.target.value)}
                        className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded-md border px-2.5 py-1 font-mono text-xs focus:ring-1 focus:outline-none"
                        placeholder="e.g. 88.00"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveBalance}
                        disabled={isSavingBalance}
                        className="bg-cf-orange text-white hover:bg-[#e87516] inline-flex cursor-pointer items-center rounded-md px-2.5 py-1 text-xs font-semibold shadow-xs disabled:opacity-50"
                      >
                        {isSavingBalance ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setIsEditingBalance(false)}
                        className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer p-1"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="text-muted-foreground border-border mt-3 flex items-center justify-between border-t pt-2.5 text-[11px]">
                  <span>Est. remaining messages:</span>
                  <span className="text-foreground font-mono font-semibold">
                    ~{summary.estimatedRemainingMessages.toLocaleString()} msgs
                  </span>
                </div>
              </div>

              {/* Card 2: Total Campaign Spends */}
              <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Total Campaign Spends
                  </span>
                  <span className="bg-cf-orange/15 text-cf-orange border-cf-orange/20 rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                    Meta Cloud API
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-muted-foreground text-xl font-semibold">
                    {currencySymbol}
                  </span>
                  <span className="text-foreground font-mono text-3xl font-extrabold tracking-tight">
                    {summary.totalSpend.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>

                <div className="text-muted-foreground border-border mt-3 flex items-center justify-between border-t pt-2.5 text-[11px]">
                  <span>
                    Marketing: {currencySymbol}
                    {summary.marketingSpend}
                  </span>
                  <span>
                    Utility: {currencySymbol}
                    {summary.utilitySpend}
                  </span>
                </div>
              </div>

              {/* Card 3: Template Insights & Engagement */}
              <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Clicks &amp; Engagement
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    <Zap className="size-3" />
                    Insights Active
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-foreground font-mono text-3xl font-extrabold tracking-tight">
                    {summary.totalClicks.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    total button clicks
                  </span>
                </div>

                <div className="text-muted-foreground border-border mt-3 flex items-center justify-between border-t pt-2.5 text-[11px]">
                  <span>Average CTR:</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {summary.overallCtr}% CTR
                  </span>
                </div>
              </div>

              {/* Card 4: WABA & WhatsApp Manager Link */}
              <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    WhatsApp Business Account
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {summary.currency}
                  </span>
                </div>

                <div className="mt-2.5">
                  <div className="text-foreground truncate text-xs font-semibold">
                    {summary.wabaName || "Mariya Technoindia Pvt Ltd"}
                  </div>
                  <div className="text-muted-foreground mt-1 flex items-center justify-between font-mono text-[11px]">
                    <span>Asset: {summary.assetId || summary.wabaId}</span>
                    <button
                      onClick={handleCopyWaba}
                      className="border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors"
                    >
                      {copiedWaba ? (
                        <>
                          <Check className="size-2.5 text-emerald-500" />
                          <span className="font-semibold text-emerald-500">
                            Copied
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-2.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="border-border mt-3 border-t pt-2.5">
                  <a
                    href={
                      summary.addFundsUrl ||
                      "https://business.facebook.com/latest/whatsapp_manager/overview?business_id=1123162246252430&asset_id=1172496625076498"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cf-orange inline-flex items-center gap-1 text-[11px] font-semibold transition-colors hover:text-[#e87516]"
                  >
                    <span>Open WhatsApp Manager Overview</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
              <div className="border-border flex items-center justify-between border-b px-5 py-3">
                <div className="bg-muted/60 flex items-center gap-1 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab("analytics")}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      activeTab === "analytics"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <BarChart3 className="size-3.5" />
                    <span>Template Analytics &amp; Spends</span>
                    <span className="bg-cf-orange/15 text-cf-orange py-0.2 rounded-full px-1.5 font-mono text-[10px]">
                      {templateAnalytics.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab("transactions")}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      activeTab === "transactions"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Clock className="size-3.5" />
                    <span>Live Transactions</span>
                    <span className="bg-muted-foreground/15 text-muted-foreground py-0.2 rounded-full px-1.5 font-mono text-[10px]">
                      {transactions.length}
                    </span>
                  </button>
                </div>

                <div className="text-muted-foreground hidden items-center gap-2 text-[11px] sm:flex">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  <span>Meta Cloud Billing Verified</span>
                </div>
              </div>

              {/* TAB 1: TEMPLATE ANALYTICS */}
              {activeTab === "analytics" && (
                <div className="space-y-4 p-5">
                  {/* Filter & Search Bar */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-sm flex-1">
                      <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search templates by name..."
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:ring-cf-orange w-full rounded-lg border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {(
                        [
                          "ALL",
                          "MARKETING",
                          "UTILITY",
                          "AUTHENTICATION"
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setTemplateCategoryFilter(cat)}
                          className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            templateCategoryFilter === cat
                              ? "bg-cf-orange text-white"
                              : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted border"
                          }`}
                        >
                          {cat === "ALL" ? "All Categories" : cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Template Table */}
                  <div className="border-border overflow-x-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground border-border border-b text-[11px] font-semibold tracking-wider uppercase">
                        <tr>
                          <th className="px-4 py-3">Template Name</th>
                          <th className="px-3 py-3">Category</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3 text-center">Insights</th>
                          <th className="px-3 py-3 text-right">Sent</th>
                          <th className="px-3 py-3 text-right">Delivered</th>
                          <th className="px-3 py-3 text-right">Read</th>
                          <th className="px-3 py-3 text-right">Clicks</th>
                          <th className="px-3 py-3 text-right">CTR</th>
                          <th className="px-4 py-3 text-right">
                            Spend ({currencySymbol})
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-border divide-y">
                        {filteredTemplates.length === 0 ? (
                          <tr>
                            <td
                              colSpan={10}
                              className="text-muted-foreground px-4 py-8 text-center text-xs"
                            >
                              No templates match your search filter.
                            </td>
                          </tr>
                        ) : (
                          filteredTemplates.map((t) => (
                            <tr
                              key={t.id}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="text-foreground font-semibold">
                                  {t.name}
                                </div>
                                <div className="text-muted-foreground font-mono text-[10px]">
                                  lang: {t.language}
                                </div>
                              </td>

                              <td className="px-3 py-3">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                    t.category === "MARKETING"
                                      ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                      : t.category === "UTILITY"
                                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  }`}
                                >
                                  {t.category}
                                </span>
                              </td>

                              <td className="px-3 py-3">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    t.status === "APPROVED"
                                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                      : t.status === "PENDING"
                                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                        : "bg-red-500/15 text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  {t.status}
                                </span>
                              </td>

                              <td className="px-3 py-3 text-center">
                                {t.insightsEnabled ? (
                                  <span
                                    title="Insights and click tracking enabled"
                                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                                  >
                                    <Zap className="size-2.5" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">
                                    Off
                                  </span>
                                )}
                              </td>

                              <td className="px-3 py-3 text-right font-mono">
                                {t.sent.toLocaleString()}
                              </td>

                              <td className="px-3 py-3 text-right font-mono">
                                {t.delivered.toLocaleString()}
                                <span className="text-muted-foreground ml-1 text-[10px]">
                                  ({t.deliveryRate}%)
                                </span>
                              </td>

                              <td className="px-3 py-3 text-right font-mono">
                                {t.read.toLocaleString()}
                                <span className="text-muted-foreground ml-1 text-[10px]">
                                  ({t.readRate}%)
                                </span>
                              </td>

                              <td className="text-foreground px-3 py-3 text-right font-mono font-medium">
                                {t.clicks.toLocaleString()}
                              </td>

                              <td className="px-3 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                {t.ctr}%
                              </td>

                              <td className="text-foreground px-4 py-3 text-right font-mono font-bold">
                                {currencySymbol}
                                {t.spend.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
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

              {/* TAB 2: LIVE TRANSACTIONS */}
              {activeTab === "transactions" && (
                <div className="space-y-4 p-5">
                  {/* Real-time Notice Banner */}
                  <div className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border p-3.5">
                    <Info className="text-cf-orange mt-0.5 size-4 shrink-0" />
                    <div className="text-xs">
                      <span className="text-foreground font-semibold">
                        Live In-Memory Transaction Ledger
                      </span>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        This ledger reflects real-time billing activity, prepaid
                        wallet funds, and template message dispatches strictly
                        for WhatsApp Business Account {summary.assetId} without
                        persisting transaction records into your database.
                      </p>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-sm flex-1">
                      <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search transactions..."
                        value={txSearch}
                        onChange={(e) => setTxSearch(e.target.value)}
                        className="border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:ring-cf-orange w-full rounded-lg border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(["ALL", "CREDIT", "DEBIT"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setTxTypeFilter(type)}
                          className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            txTypeFilter === type
                              ? "bg-cf-orange text-white"
                              : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted border"
                          }`}
                        >
                          {type === "ALL"
                            ? "All Types"
                            : type === "CREDIT"
                              ? "Credits (+)"
                              : "Debits (-)"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Transactions Table */}
                  <div className="border-border overflow-x-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground border-border border-b text-[11px] font-semibold tracking-wider uppercase">
                        <tr>
                          <th className="px-4 py-3">Date &amp; Time</th>
                          <th className="px-3 py-3">Transaction ID</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-3 py-3">Category</th>
                          <th className="px-3 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-border divide-y">
                        {filteredTransactions.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="text-muted-foreground px-4 py-8 text-center text-xs"
                            >
                              No transactions match your search filter.
                            </td>
                          </tr>
                        ) : (
                          filteredTransactions.map((tx) => (
                            <tr
                              key={tx.id}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="text-muted-foreground px-4 py-3 font-mono text-[11px] whitespace-nowrap">
                                {new Date(tx.date).toLocaleString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </td>

                              <td className="text-muted-foreground px-3 py-3 font-mono text-[11px]">
                                {tx.id.slice(0, 18)}...
                              </td>

                              <td className="px-4 py-3">
                                <div className="text-foreground font-medium">
                                  {tx.description}
                                </div>
                                {tx.reference && (
                                  <div className="text-muted-foreground font-mono text-[10px]">
                                    Ref: {tx.reference}
                                  </div>
                                )}
                              </td>

                              <td className="px-3 py-3">
                                <span className="border-border bg-muted/70 text-muted-foreground rounded border px-1.5 py-0.5 text-[10px] font-semibold">
                                  {tx.category}
                                </span>
                              </td>

                              <td className="px-3 py-3 text-center">
                                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  {tx.status}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                                {tx.type === "CREDIT" ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                    <ArrowDownLeft className="size-3" />+
                                    {currencySymbol}
                                    {tx.amount.toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-foreground inline-flex items-center gap-1">
                                    <ArrowUpRight className="text-muted-foreground size-3" />
                                    -{currencySymbol}
                                    {tx.amount.toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </span>
                                )}
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
          </>
        )}
      </div>
    </div>
  );
}
