"use client";

import {
  GitFork,
  Plus,
  Play,
  Edit2,
  Trash2,
  Search,
  Clock,
  Sparkles,
  RefreshCw,
  Loader2,
  X,
  User,
  ShieldAlert
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  WorkflowItem,
  WorkflowExecutionItem
} from "@/components/workflows/types";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isOwner } = useAuth();

  const canViewWorkflows = isOwner || hasPermission(PERMISSIONS.WORKFLOW_VIEW);
  const canManageWorkflows =
    isOwner || hasPermission(PERMISSIONS.WORKFLOW_MANAGE);

  const [search, setSearch] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("ALL");
  const [selectedWorkflowForLogs, setSelectedWorkflowForLogs] =
    useState<WorkflowItem | null>(null);
  const [testModalWorkflow, setTestModalWorkflow] =
    useState<WorkflowItem | null>(null);
  const [testCustomerId, setTestCustomerId] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [customers, setCustomers] = useState<
    Array<{ id: string; name: string; phone: string }>
  >([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);

  // Fetch Workflows
  const {
    data: workflows = [],
    isLoading,
    isFetching,
    refetch
  } = useQuery<WorkflowItem[]>({
    queryKey: ["workflows"],
    queryFn: async () => {
      const res = await fetch("/api/workflows");
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to fetch workflows");
      }
      return json.data || [];
    },
    enabled: canViewWorkflows
  });

  // Toggle Active State Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive })
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to update workflow");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow status updated");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  });

  // Delete Workflow Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to delete workflow");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow deleted successfully");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  });

  // 1-Click Create User Gender Demo Template
  const handleCreateGenderDemoFlow = async () => {
    try {
      toast.info("Creating Gender Quick-Replies workflow...");
      const payload = {
        name: "Gender Inquiries & Custom Responses",
        description:
          "Asks 'What is your gender?' with 3 quick replies: Male (Message), Female (PDF Brochure), Non-binary (API Webhook).",
        isActive: true,
        triggerType: "KEYWORD",
        triggerKeywords: ["gender", "admission", "start"],
        steps: [
          {
            id: "step_question_gender",
            type: "QUESTION",
            config: {
              headerText: "Admissions Center",
              bodyText: "Hello {{customer.name}}! What is your gender?",
              footerText: "Please tap an option below",
              options: [
                {
                  id: "btn_male",
                  title: "Male",
                  actions: [
                    {
                      id: "male_send_msg",
                      type: "SEND_MESSAGE",
                      config: {
                        text: "Welcome {{customer.name}}! Here is our campus information for male applicants."
                      }
                    },
                    {
                      id: "male_update_cust",
                      type: "UPDATE_CUSTOMER",
                      config: {
                        addTags: ["Male", "Applicant"],
                        metadata: { gender: "Male" }
                      }
                    }
                  ]
                },
                {
                  id: "btn_female",
                  title: "Female",
                  actions: [
                    {
                      id: "female_send_pdf",
                      type: "SEND_MEDIA",
                      config: {
                        mediaType: "DOCUMENT",
                        fileName: "Girls_Campus_Guide.pdf",
                        mediaUrl:
                          "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                        caption: "Here is our Girls Campus Guide PDF brochure!"
                      }
                    },
                    {
                      id: "female_update_cust",
                      type: "UPDATE_CUSTOMER",
                      config: {
                        addTags: ["Female", "Applicant"],
                        metadata: { gender: "Female" }
                      }
                    }
                  ]
                },
                {
                  id: "btn_non_binary",
                  title: "Non-binary",
                  actions: [
                    {
                      id: "nb_call_api",
                      type: "CALL_API",
                      config: {
                        method: "POST",
                        url: "https://httpbin.org/post",
                        bodyJson: JSON.stringify(
                          {
                            customerPhone: "{{customer.phoneNumber}}",
                            customerName: "{{customer.name}}",
                            selectedGender: "Non-binary",
                            source: "whatsapp_workflow"
                          },
                          null,
                          2
                        )
                      }
                    },
                    {
                      id: "nb_send_msg",
                      type: "SEND_MESSAGE",
                      config: {
                        text: "Thank you {{customer.name}}! Your response has been logged into our admissions database."
                      }
                    }
                  ]
                }
              ]
            }
          }
        ]
      };

      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to create workflow");
      }

      toast.success("Gender Quick-Replies workflow created!");
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Creation failed");
    }
  };

  const openTestModal = async (wf: WorkflowItem) => {
    setTestModalWorkflow(wf);
    if (customers.length === 0) {
      try {
        setIsLoadingCustomers(true);
        const res = await fetch("/api/customers?limit=20");
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setCustomers(
            json.data.map(
              (c: {
                id: string;
                customName?: string | null;
                whatsappName?: string | null;
                normalizedPhone: string;
              }) => ({
                id: c.id,
                name: c.customName || c.whatsappName || "Unknown",
                phone: c.normalizedPhone
              })
            )
          );
          if (json.data[0]?.id) {
            setTestCustomerId(json.data[0].id);
          }
        }
      } catch {
        toast.error("Failed to load customer list");
      } finally {
        setIsLoadingCustomers(false);
      }
    }
  };

  const handleExecuteTest = async () => {
    if (!testModalWorkflow?.id || !testCustomerId) {
      toast.error("Please select a target customer");
      return;
    }

    try {
      setIsTesting(true);
      const res = await fetch(`/api/workflows/${testModalWorkflow.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: testCustomerId })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.message || "Execution failed");
      }

      toast.success(
        "Workflow triggered! Customer received the question buttons on WhatsApp."
      );
      setTestModalWorkflow(null);
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setIsTesting(false);
    }
  };

  // Filtered workflows
  const filteredWorkflows = workflows.filter((wf) => {
    const matchesSearch =
      wf.name.toLowerCase().includes(search.toLowerCase()) ||
      (wf.description &&
        wf.description.toLowerCase().includes(search.toLowerCase())) ||
      (wf.triggerKeywords &&
        wf.triggerKeywords.some((k) =>
          k.toLowerCase().includes(search.toLowerCase())
        ));

    const matchesTrigger =
      triggerFilter === "ALL" || wf.triggerType === triggerFilter;

    return matchesSearch && matchesTrigger;
  });

  const totalRuns = workflows.reduce(
    (acc, curr) => acc + (curr.totalExecutions || 0),
    0
  );
  const activeCount = workflows.filter((wf) => wf.isActive).length;
  const waitingCount = workflows.reduce(
    (acc, curr) => acc + (curr.waitingCount || 0),
    0
  );

  if (!canViewWorkflows) {
    return (
      <div className="bg-background flex h-full flex-col items-center justify-center p-6 text-center select-none">
        <ShieldAlert className="text-muted-foreground mb-3 size-10" />
        <h2 className="text-foreground text-base font-semibold">
          Access Restricted
        </h2>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          You do not have permission to view Interactive Workflows. Please
          contact your CRM Administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col overflow-y-auto p-4 select-none sm:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-cf-orange/15 text-cf-orange flex size-8 items-center justify-center rounded-lg">
                <GitFork className="size-4" />
              </div>
              <h1 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
                Interactive Workflows
              </h1>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Automate two-way WhatsApp conversations with interactive button
              questions and sequential chained actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 cursor-pointer gap-1.5 text-xs"
            >
              <RefreshCw
                className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </Button>

            {canManageWorkflows && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateGenderDemoFlow}
                  className="text-cf-orange border-cf-orange/40 hover:bg-cf-orange/10 h-8 cursor-pointer gap-1.5 text-xs"
                >
                  <Sparkles className="size-3.5" />
                  <span>Create Gender Demo Flow</span>
                </Button>

                <Link href="/workflows/new">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-cf-orange hover:bg-cf-orange/90 h-8 cursor-pointer gap-1.5 text-xs font-semibold text-white shadow-xs"
                  >
                    <Plus className="size-3.5" />
                    <span>Create Workflow</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="border-border bg-card rounded-xl border p-3.5 shadow-xs">
            <span className="text-muted-foreground block text-[11px] font-medium">
              Total Workflows
            </span>
            <span className="text-foreground mt-1 block text-xl font-bold">
              {workflows.length}
            </span>
          </div>

          <div className="border-border bg-card rounded-xl border p-3.5 shadow-xs">
            <span className="text-muted-foreground block text-[11px] font-medium">
              Active Workflows
            </span>
            <span className="mt-1 block text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </span>
          </div>

          <div className="border-border bg-card rounded-xl border p-3.5 shadow-xs">
            <span className="text-muted-foreground block text-[11px] font-medium">
              Total Executions
            </span>
            <span className="text-foreground mt-1 block text-xl font-bold">
              {totalRuns}
            </span>
          </div>

          <div className="border-border bg-card rounded-xl border p-3.5 shadow-xs">
            <span className="text-muted-foreground block text-[11px] font-medium">
              Waiting for Customer Reply
            </span>
            <span className="mt-1 block text-xl font-bold text-blue-600 dark:text-blue-400">
              {waitingCount}
            </span>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, description, keyword..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground mr-1 text-xs">Trigger:</span>
            {["ALL", "KEYWORD", "ANY_INBOUND", "MANUAL"].map((type) => (
              <button
                key={type}
                onClick={() => setTriggerFilter(type)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  triggerFilter === type
                    ? "bg-accent text-cf-orange font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {type === "ALL"
                  ? "All"
                  : type === "KEYWORD"
                    ? "Keyword"
                    : type === "ANY_INBOUND"
                      ? "Inbound"
                      : "Manual"}
              </button>
            ))}
          </div>
        </div>

        {/* Workflows List */}
        {isLoading ? (
          <div className="border-border bg-card flex items-center justify-center rounded-xl border py-16">
            <Loader2 className="text-cf-orange size-6 animate-spin" />
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <GitFork className="text-muted-foreground/40 mb-3 size-10" />
            <h3 className="text-foreground text-sm font-semibold">
              {search || triggerFilter !== "ALL"
                ? "No matching workflows found"
                : "No workflows created yet"}
            </h3>
            <p className="text-muted-foreground mt-1 mb-4 max-w-sm text-xs">
              Create an automated flow that sends questions with buttons,
              delivers PDFs, updates records, or calls external APIs.
            </p>
            {canManageWorkflows && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateGenderDemoFlow}
                  className="text-cf-orange border-cf-orange/40 hover:bg-cf-orange/10 cursor-pointer gap-1.5 text-xs"
                >
                  <Sparkles className="size-3.5" />
                  Load Gender Demo Flow
                </Button>
                <Link href="/workflows/new">
                  <Button
                    size="sm"
                    className="bg-cf-orange hover:bg-cf-orange/90 text-xs text-white"
                  >
                    <Plus className="mr-1 size-3.5" /> Create Workflow
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredWorkflows.map((wf) => {
              const stepCount = Array.isArray(wf.steps) ? wf.steps.length : 0;

              return (
                <div
                  key={wf.id}
                  className="border-border bg-card hover:border-border/80 space-y-3 rounded-xl border p-4 shadow-xs transition-all sm:p-5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-foreground text-sm font-bold">
                          {wf.name}
                        </h3>

                        {/* Trigger Type Badge */}
                        <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 font-mono text-[10px] font-medium">
                          {wf.triggerType === "KEYWORD"
                            ? "Keyword Trigger"
                            : wf.triggerType === "ANY_INBOUND"
                              ? "Any Inbound"
                              : "Manual"}
                        </span>

                        <span className="bg-cf-orange/10 text-cf-orange rounded px-2 py-0.5 text-[10px] font-semibold">
                          {stepCount} {stepCount === 1 ? "step" : "steps"}
                        </span>
                      </div>

                      {wf.description && (
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                          {wf.description}
                        </p>
                      )}

                      {/* Keywords list if keyword trigger */}
                      {wf.triggerType === "KEYWORD" &&
                        wf.triggerKeywords &&
                        wf.triggerKeywords.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <span className="text-muted-foreground text-[10px] font-medium">
                              Keywords:
                            </span>
                            {wf.triggerKeywords.map((kw) => (
                              <span
                                key={kw}
                                className="bg-accent/60 text-foreground rounded px-1.5 py-0.5 font-mono text-[10px]"
                              >
                                &ldquo;{kw}&rdquo;
                              </span>
                            ))}
                          </div>
                        )}
                    </div>

                    {/* Active Switch and Controls */}
                    <div className="flex items-center gap-3 pt-2 sm:pt-0">
                      {canManageWorkflows && (
                        <label className="flex cursor-pointer items-center gap-2">
                          <span className="text-muted-foreground text-[11px] font-medium">
                            {wf.isActive ? "Active" : "Disabled"}
                          </span>
                          <input
                            type="checkbox"
                            checked={wf.isActive}
                            onChange={(e) =>
                              toggleActiveMutation.mutate({
                                id: wf.id,
                                isActive: e.target.checked
                              })
                            }
                            className="sr-only"
                          />
                          <div
                            className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              wf.isActive ? "bg-cf-orange" : "bg-muted"
                            }`}
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: wf.id,
                                isActive: !wf.isActive
                              })
                            }
                          >
                            <span
                              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                wf.isActive ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Execution Metrics & Action Buttons */}
                  <div className="border-border/50 flex flex-col gap-3 border-t pt-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-muted-foreground flex items-center gap-4 text-[11px]">
                      <span>
                        Total runs:{" "}
                        <strong className="text-foreground font-mono">
                          {wf.totalExecutions || 0}
                        </strong>
                      </span>
                      <span>
                        Completed:{" "}
                        <strong className="font-mono text-emerald-600">
                          {wf.completedCount || 0}
                        </strong>
                      </span>
                      <span>
                        Waiting for reply:{" "}
                        <strong className="font-mono text-blue-600">
                          {wf.waitingCount || 0}
                        </strong>
                      </span>
                      {(wf.failedCount || 0) > 0 && (
                        <span>
                          Failed:{" "}
                          <strong className="text-destructive font-mono">
                            {wf.failedCount}
                          </strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedWorkflowForLogs(wf)}
                        className="text-muted-foreground hover:text-foreground h-7 cursor-pointer text-xs"
                      >
                        <Clock className="mr-1 size-3" />
                        Executions Log
                      </Button>

                      {canManageWorkflows && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openTestModal(wf)}
                            className="h-7 cursor-pointer gap-1 text-xs"
                          >
                            <Play className="size-3 text-emerald-500" />
                            <span>Test Flow</span>
                          </Button>

                          <Link href={`/workflows/${wf.id}`}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 cursor-pointer gap-1 text-xs"
                            >
                              <Edit2 className="size-3" />
                              <span>Edit</span>
                            </Button>
                          </Link>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (
                                confirm(
                                  `Are you sure you want to delete workflow "${wf.name}"?`
                                )
                              ) {
                                deleteMutation.mutate(wf.id);
                              }
                            }}
                            className="text-destructive hover:bg-destructive/10 h-7 cursor-pointer text-xs"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Test Live Workflow Modal */}
      {testModalWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="border-border bg-card w-full max-w-md space-y-4 rounded-xl border p-5 shadow-xl">
            <div className="border-border/60 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Play className="size-4 text-emerald-500" />
                <h3 className="text-foreground text-sm font-semibold">
                  Run Workflow: {testModalWorkflow.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTestModalWorkflow(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-muted-foreground text-xs">
              Select a customer to send this workflow to. If the workflow asks a
              question with quick replies, the customer will receive interactive
              buttons on WhatsApp!
            </p>

            {isLoadingCustomers ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="text-cf-orange size-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-foreground block text-xs font-medium">
                  Select Customer:
                </label>
                <select
                  value={testCustomerId}
                  onChange={(e) => setTestCustomerId(e.target.value)}
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-xs focus-visible:ring-1 focus-visible:outline-none"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="border-border/60 flex items-center justify-end gap-2 border-t pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestModalWorkflow(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteTest}
                disabled={isTesting || !testCustomerId}
                className="h-8 cursor-pointer gap-1.5 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {isTesting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                <span>Run Flow Live</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Logs Drawer / Modal */}
      {selectedWorkflowForLogs && (
        <ExecutionLogsDrawer
          workflow={selectedWorkflowForLogs}
          onClose={() => setSelectedWorkflowForLogs(null)}
        />
      )}
    </div>
  );
}

function ExecutionLogsDrawer({
  workflow,
  onClose
}: {
  workflow: WorkflowItem;
  onClose: () => void;
}) {
  const { data: details, isLoading } = useQuery({
    queryKey: ["workflow-executions", workflow.id],
    queryFn: async () => {
      const res = await fetch(`/api/workflows/${workflow.id}`);
      const json = await res.json();
      return json.data;
    }
  });

  const executions: WorkflowExecutionItem[] = details?.executions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="border-border bg-card flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-xl">
        <div className="border-border/60 bg-muted/20 flex items-center justify-between border-b p-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              Execution Logs: {workflow.name}
            </h3>
            <p className="text-muted-foreground text-[11px]">
              Showing recent workflow runs and customer quick reply interactions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-cf-orange size-5 animate-spin" />
            </div>
          ) : executions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="text-muted-foreground/40 mb-2 size-8" />
              <p className="text-muted-foreground text-xs">
                No execution logs recorded yet for this workflow.
              </p>
            </div>
          ) : (
            executions.map((exec) => {
              const customerName =
                exec.customer?.customName ||
                exec.customer?.whatsappName ||
                exec.customer?.normalizedPhone ||
                "Unknown Customer";

              return (
                <div
                  key={exec.id}
                  className="border-border/70 bg-background/50 space-y-2 rounded-lg border p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="text-muted-foreground size-3.5" />
                      <span className="text-foreground font-semibold">
                        {customerName}
                      </span>
                      {exec.customer?.normalizedPhone && (
                        <span className="text-muted-foreground font-mono text-[11px]">
                          ({exec.customer.normalizedPhone})
                        </span>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${
                        exec.status === "COMPLETED"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : exec.status === "WAITING_FOR_INPUT"
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : exec.status === "FAILED"
                              ? "bg-red-500/15 text-red-600 dark:text-red-400"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {exec.status === "WAITING_FOR_INPUT"
                        ? "WAITING FOR REPLY"
                        : exec.status}
                    </span>
                  </div>

                  {Boolean(exec.contextData?.lastReplyText) && (
                    <div className="bg-muted/40 rounded px-2.5 py-1.5 font-mono text-[11px]">
                      <span className="text-muted-foreground">
                        Customer Tapped:{" "}
                      </span>
                      <strong className="text-cf-orange">
                        &ldquo;{String(exec.contextData?.lastReplyText)}&rdquo;
                      </strong>
                    </div>
                  )}

                  {exec.errorLog && (
                    <div className="rounded border border-red-500/30 bg-red-500/10 p-2 font-mono text-[10px] text-red-600">
                      {exec.errorLog}
                    </div>
                  )}

                  <div className="text-muted-foreground text-[10px]">
                    Started: {new Date(exec.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-border/60 bg-muted/10 flex justify-end border-t p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
