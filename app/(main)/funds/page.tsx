"use client";

import {
  Wallet,
  ExternalLink,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  CheckCircle2,
  AlertCircle,
  Search,
  BarChart3,
  TrendingUp,
  Layers,
  Copy,
  Check,
  MousePointerClick,
  Send,
  CheckCheck,
  Eye,
  Clock,
  ShieldCheck,
  Info
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
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

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery<
    FundsApiResponse
  >({
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
                className={`size-3.5 ${isFetching ? "animate-spin text-cf-orange" : ""}`}
              />
              <span>{isFetching ? "Syncing..." : "Sync Live"}</span>
            </button>

            {/* Primary Add Funds in WhatsApp Manager Button */}
            <a
              href={
                summary?.addFundsUrl ||
                "https://business.facebook.com/wa/manage/payment-methods/"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="bg-cf-orange hover:bg-[#e87516] text-white shadow-cf-orange/20 inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
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
            <div className="flex items-center gap-2 text-destructive font-semibold">
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
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    Available Funds Left
                  </span>
                  <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    {summary.accountHealth}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-muted-foreground text-xl font-semibold">
                    {currencySymbol}
                  </span>
                  <span className="text-foreground text-3xl font-extrabold tracking-tight font-mono">
                    {summary.balance.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border pt-2.5">
                  <span>Est. remaining messages:</span>
                  <span className="text-foreground font-mono font-semibold">
                    ~{summary.estimatedRemainingMessages.toLocaleString()} msgs
                  </span>
                </div>
              </div>

              {/* Card 2: Total Campaign Spends */}
              <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    Total Campaign Spends
                  </span>
                  <span className="bg-cf-orange/15 text-cf-orange border border-cf-orange/20 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    Meta Cloud API
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-muted-foreground text-xl font-semibold">
                    {currencySymbol}
                  </span>
                  <span className="text-foreground text-3xl font-extrabold tracking-tight font-mono">
                    {summary.totalSpend.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border pt-2.5">
                  <span>Marketing: {currencySymbol}{summary.marketingSpend}</span>
                  <span>Utility: {currencySymbol}{summary.utilitySpend}</span>
                </div>
              </div>

              {/* Card 3: Template Insights & Engagement */}
              <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    Clicks &amp; Engagement
                  </span>
                  <span className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    <Zap className="size-3" />
                    Insights Active
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-foreground text-3xl font-extrabold tracking-tight font-mono">
                    {summary.totalClicks.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    total button clicks
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border pt-2.5">
                  <span>Average CTR:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                    {summary.overallCtr}% CTR
                  </span>
                </div>
              </div>

              {/* Card 4: WABA & WhatsApp Manager Link */}
              <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    WhatsApp Business Account
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {summary.currency}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="font-mono text-xs font-semibold text-foreground">
                    ID: {summary.wabaId.slice(0, 5)}...{summary.wabaId.slice(-4)}
                  </div>
                  <button
                    onClick={handleCopyWaba}
                    className="border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors"
                  >
                    {copiedWaba ? (
                      <>
                        <Check className="size-3 text-emerald-500" />
                        <span className="text-emerald-500 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-3 border-t border-border pt-2.5">
                  <a
                    href={summary.addFundsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cf-orange hover:text-[#e87516] inline-flex items-center gap-1 text-[11px] font-semibold transition-colors"
                  >
                    <span>Manage Payment Methods</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="border-border bg-card rounded-xl border shadow-xs overflow-hidden">
              <div className="border-border flex items-center justify-between border-b px-5 py-3">
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
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
                    <span className="bg-cf-orange/15 text-cf-orange text-[10px] px-1.5 py-0.2 rounded-full font-mono">
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
                    <span className="bg-muted-foreground/15 text-muted-foreground text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                      {transactions.length}
                    </span>
                  </button>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  <span>Meta Cloud Billing Verified</span>
                </div>
              </div>

              {/* TAB 1: TEMPLATE ANALYTICS */}
              {activeTab === "analytics" && (
                <div className="p-5 space-y-4">
                  {/* Filter & Search Bar */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1 max-w-sm">
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
                      {(["ALL", "MARKETING", "UTILITY", "AUTHENTICATION"] as const).map(
                        (cat) => (
                          <button
                            key={cat}
                            onClick={() => setTemplateCategoryFilter(cat)}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                              templateCategoryFilter === cat
                                ? "bg-cf-orange text-white"
                                : "border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            {cat === "ALL" ? "All Categories" : cat}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Template Table */}
                  <div className="border-border rounded-lg border overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground border-border border-b text-[11px] font-semibold uppercase tracking-wider">
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
                          <th className="px-4 py-3 text-right">Spend ({currencySymbol})</th>
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
                                <div className="font-semibold text-foreground">
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
                                    className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
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

                              <td className="px-3 py-3 text-right font-mono font-medium text-foreground">
                                {t.clicks.toLocaleString()}
                              </td>

                              <td className="px-3 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                {t.ctr}%
                              </td>

                              <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
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
                <div className="p-5 space-y-4">
                  {/* Real-time Notice Banner */}
                  <div className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border p-3.5">
                    <Info className="text-cf-orange size-4 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="text-foreground font-semibold">
                        Live In-Memory Transaction Ledger
                      </span>
                      <p className="text-muted-foreground text-[11px] mt-0.5">
                        This ledger reflects real-time billing activity, credit top-ups,
                        broadcast dispatch debits, and direct WhatsApp conversations
                        without persisting transaction records into your database.
                      </p>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1 max-w-sm">
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
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                            txTypeFilter === type
                              ? "bg-cf-orange text-white"
                              : "border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
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
                  <div className="border-border rounded-lg border overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground border-border border-b text-[11px] font-semibold uppercase tracking-wider">
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
                              <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                                {new Date(tx.date).toLocaleString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </td>

                              <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
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
                                <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                                  {tx.status}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                                {tx.type === "CREDIT" ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                                    <ArrowDownLeft className="size-3" />+
                                    {currencySymbol}
                                    {tx.amount.toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-foreground inline-flex items-center gap-1">
                                    <ArrowUpRight className="size-3 text-muted-foreground" />
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
