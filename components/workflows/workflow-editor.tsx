"use client";

import {
  GitFork,
  Save,
  Play,
  HelpCircle,
  MessageSquare,
  FileText,
  Clock,
  UserCheck,
  Globe,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  X
} from "lucide-react";
import {
  WorkflowItem,
  WorkflowAction,
  WorkflowTriggerType,
  WorkflowActionType
} from "./types";
import React, { useState } from "react";
import { ActionItemCard } from "./action-item-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface WorkflowEditorProps {
  initialWorkflow?: WorkflowItem;
  isNew?: boolean;
}

export function WorkflowEditor({
  initialWorkflow,
  isNew = false
}: WorkflowEditorProps) {
  const router = useRouter();

  const [name, setName] = useState(initialWorkflow?.name || "");
  const [description, setDescription] = useState(
    initialWorkflow?.description || ""
  );
  const [isActive, setIsActive] = useState(initialWorkflow?.isActive ?? true);
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>(
    initialWorkflow?.triggerType || "KEYWORD"
  );
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>(
    initialWorkflow?.triggerKeywords || ["gender", "start"]
  );
  const [keywordInput, setKeywordInput] = useState("");
  const [steps, setSteps] = useState<WorkflowAction[]>(
    initialWorkflow?.steps || []
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testCustomerId, setTestCustomerId] = useState("");
  const [customers, setCustomers] = useState<
    Array<{ id: string; name: string; phone: string }>
  >([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);

  // Load User's Exact Gender Demo Template
  const loadGenderDemoTemplate = () => {
    setName("Gender Inquiries & Custom Responses");
    setDescription(
      "Interactive flow asking gender and branching to text, PDF, and external API webhook"
    );
    setTriggerType("KEYWORD");
    setTriggerKeywords(["gender", "admissions", "start"]);
    setSteps([
      {
        id: "step_question_1",
        type: "QUESTION",
        config: {
          headerText: "Student Admissions",
          bodyText: "Hello {{customer.name}}! What is your gender?",
          footerText: "Please tap one option below",
          options: [
            {
              id: "btn_male",
              title: "Male",
              actions: [
                {
                  id: "male_act_msg",
                  type: "SEND_MESSAGE",
                  config: {
                    text: "Thank you for confirming! Here is our campus information for boys. We look forward to welcoming you."
                  }
                },
                {
                  id: "male_act_update",
                  type: "UPDATE_CUSTOMER",
                  config: {
                    addTags: ["Male", "Enquiry"],
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
                  id: "female_act_media",
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
                  id: "female_act_update",
                  type: "UPDATE_CUSTOMER",
                  config: {
                    addTags: ["Female", "Enquiry"],
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
                  id: "nb_act_api",
                  type: "CALL_API",
                  config: {
                    method: "POST",
                    url: "https://httpbin.org/post",
                    bodyJson: JSON.stringify(
                      {
                        customerPhone: "{{customer.phoneNumber}}",
                        customerName: "{{customer.name}}",
                        selectedGender: "Non-binary",
                        timestamp: new Date().toISOString()
                      },
                      null,
                      2
                    )
                  }
                },
                {
                  id: "nb_act_msg",
                  type: "SEND_MESSAGE",
                  config: {
                    text: "Thank you {{customer.name}}! We have logged your response in our admissions registry."
                  }
                }
              ]
            }
          ]
        }
      }
    ]);
    toast.success("Loaded 'Gender Question & Branching' template!");
  };

  const handleAddKeyword = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ("key" in e && e.key !== "Enter") return;
    e.preventDefault();
    const clean = keywordInput.trim().toLowerCase();
    if (clean && !triggerKeywords.includes(clean)) {
      setTriggerKeywords([...triggerKeywords, clean]);
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setTriggerKeywords(triggerKeywords.filter((k) => k !== kw));
  };

  const handleAddAction = (type: WorkflowActionType) => {
    const id = `step_${Date.now()}`;
    let config: Record<string, unknown> = {};

    if (type === "QUESTION") {
      config = {
        bodyText: "What is your gender?",
        options: [
          { id: "male", title: "Male", actions: [] },
          { id: "female", title: "Female", actions: [] },
          { id: "non_binary", title: "Non-binary", actions: [] }
        ]
      };
    } else if (type === "SEND_MESSAGE") {
      config = { text: "Hello {{customer.name}}!" };
    } else if (type === "SEND_MEDIA") {
      config = {
        mediaType: "DOCUMENT",
        fileName: "brochure.pdf",
        mediaUrl: ""
      };
    } else if (type === "WAIT_DELAY") {
      config = { delaySeconds: 3 };
    } else if (type === "UPDATE_CUSTOMER") {
      config = { addTags: ["Inquiry"] };
    } else if (type === "CALL_API") {
      config = {
        method: "POST",
        url: "https://api.example.com/webhook",
        bodyJson: '{\n  "phone": "{{customer.phoneNumber}}"\n}'
      };
    } else if (type === "START_WORKFLOW") {
      config = { workflowId: "" };
    }

    setSteps([...steps, { id, type, config }]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Workflow name is required");
      return;
    }

    if (steps.length === 0) {
      toast.error("Please add at least one step to the workflow");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        isActive,
        triggerType,
        triggerKeywords,
        steps
      };

      const url = isNew
        ? "/api/workflows"
        : `/api/workflows/${initialWorkflow?.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.message || "Failed to save workflow");
      }

      toast.success(
        isNew ? "Workflow created successfully!" : "Workflow saved!"
      );
      router.push("/workflows");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const openTestModal = async () => {
    setShowTestModal(true);
    if (customers.length === 0) {
      try {
        setIsLoadingCustomers(true);
        const res = await fetch("/api/customers?limit=15");
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
        toast.error("Failed to load customers for test");
      } finally {
        setIsLoadingCustomers(false);
      }
    }
  };

  const handleRunTest = async () => {
    if (!initialWorkflow?.id) {
      toast.error("Please save the workflow first before running live test");
      return;
    }
    if (!testCustomerId) {
      toast.error("Please select a customer to test with");
      return;
    }

    try {
      setIsTesting(true);
      const res = await fetch(`/api/workflows/${initialWorkflow.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: testCustomerId })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.message || "Test failed");
      }

      toast.success(
        "Workflow triggered! Check customer conversation in Inbox."
      );
      setShowTestModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Test failed";
      toast.error(msg);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-background flex h-full flex-col overflow-y-auto p-4 select-none sm:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/workflows"
              className="border-border bg-card text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md border transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
                {isNew
                  ? "Create Interactive Workflow"
                  : `Edit Workflow: ${name}`}
              </h1>
              <p className="text-muted-foreground text-xs">
                Configure &ldquo;When this happens → Do this → Then do
                this&rdquo;
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadGenderDemoTemplate}
              className="text-cf-orange border-cf-orange/40 hover:bg-cf-orange/10 h-8 cursor-pointer gap-1.5 text-xs"
            >
              <Sparkles className="size-3.5" />
              <span>Load Gender Demo Flow</span>
            </Button>

            {!isNew && initialWorkflow?.id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openTestModal}
                className="h-8 cursor-pointer gap-1.5 text-xs"
              >
                <Play className="size-3.5 text-emerald-500" />
                <span>Test Flow</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-cf-orange hover:bg-cf-orange/90 h-8 cursor-pointer gap-1.5 text-xs font-semibold text-white shadow-xs"
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>{isNew ? "Create Workflow" : "Save Changes"}</span>
            </Button>
          </div>
        </div>

        {/* SECTION 1: Workflow Info & Trigger */}
        <div className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-xs sm:p-5">
          <div className="border-border/60 flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-cf-orange/10 text-cf-orange flex size-7 items-center justify-center rounded">
                <GitFork className="size-4" />
              </div>
              <h2 className="text-foreground text-sm font-semibold">
                1. General Settings & Trigger
              </h2>
            </div>

            {/* Active Toggle */}
            <label className="flex cursor-pointer items-center gap-2">
              <span className="text-foreground text-xs font-medium">
                {isActive ? "Active" : "Disabled"}
              </span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  isActive ? "bg-cf-orange" : "bg-muted"
                }`}
                onClick={() => setIsActive(!isActive)}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isActive ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                Workflow Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gender Inquiries & Campus Info"
                className="h-9 text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                Description (optional)
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Asks gender and branches response"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Trigger Configuration */}
          <div className="space-y-3 pt-2">
            <label className="text-foreground block text-xs font-medium">
              When should this workflow start?
            </label>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div
                onClick={() => setTriggerType("KEYWORD")}
                className={`flex cursor-pointer flex-col rounded-lg border p-3 transition-all ${
                  triggerType === "KEYWORD"
                    ? "border-cf-orange bg-cf-orange/5 ring-cf-orange ring-1"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-xs font-semibold">
                    Keyword Trigger
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Starts when customer message contains defined keywords (e.g.
                  &ldquo;gender&rdquo;).
                </p>
              </div>

              <div
                onClick={() => setTriggerType("ANY_INBOUND")}
                className={`flex cursor-pointer flex-col rounded-lg border p-3 transition-all ${
                  triggerType === "ANY_INBOUND"
                    ? "border-cf-orange bg-cf-orange/5 ring-cf-orange ring-1"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-xs font-semibold">
                    Any Inbound Message
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Starts on any new incoming message from a customer.
                </p>
              </div>

              <div
                onClick={() => setTriggerType("MANUAL")}
                className={`flex cursor-pointer flex-col rounded-lg border p-3 transition-all ${
                  triggerType === "MANUAL"
                    ? "border-cf-orange bg-cf-orange/5 ring-cf-orange ring-1"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-xs font-semibold">
                    Manual Only
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Only triggered via CRM agent button or external API.
                </p>
              </div>
            </div>

            {/* Keyword tag input if KEYWORD trigger */}
            {triggerType === "KEYWORD" && (
              <div className="border-border/80 bg-background/50 space-y-2 rounded-lg border p-3">
                <span className="text-foreground text-xs font-medium">
                  Trigger Keywords
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {triggerKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="bg-cf-orange/15 text-cf-orange inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-medium"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(kw)}
                        className="cursor-pointer hover:opacity-75"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={handleAddKeyword}
                      placeholder="Type keyword and press Enter"
                      className="h-7 w-48 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddKeyword}
                      className="h-7 cursor-pointer px-2 text-xs"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: Action Chain Steps */}
        <div className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-xs sm:p-5">
          <div className="border-border/60 flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-foreground text-sm font-semibold">
                2. Actions & Branching Flow
              </h2>
              <p className="text-muted-foreground text-[11px]">
                Configure sequential actions. Each quick reply can have its own
                independent chain.
              </p>
            </div>

            <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 font-mono text-xs font-medium">
              {steps.length} {steps.length === 1 ? "step" : "steps"}
            </span>
          </div>

          {/* Sequential Steps List */}
          {steps.length === 0 ? (
            <div className="border-border flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
              <HelpCircle className="text-muted-foreground/50 mb-2 size-8" />
              <p className="text-foreground text-xs font-medium">
                No steps added yet
              </p>
              <p className="text-muted-foreground mt-0.5 mb-4 max-w-sm text-[11px]">
                Click below to add a Question with Quick Replies, Send Message,
                Send PDF, or Call API.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadGenderDemoTemplate}
                className="text-cf-orange border-cf-orange/40 hover:bg-cf-orange/10 gap-1.5 text-xs"
              >
                <Sparkles className="size-3.5" />
                Load Gender Example Template
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((action, idx) => (
                <ActionItemCard
                  key={action.id || idx}
                  action={action}
                  index={idx}
                  total={steps.length}
                  onChange={(updated) => {
                    const newSteps = [...steps];
                    newSteps[idx] = updated;
                    setSteps(newSteps);
                  }}
                  onDelete={() => {
                    setSteps(steps.filter((_, i) => i !== idx));
                  }}
                  onMoveUp={
                    idx > 0
                      ? () => {
                          const newSteps = [...steps];
                          const temp = newSteps[idx];
                          newSteps[idx] = newSteps[idx - 1];
                          newSteps[idx - 1] = temp;
                          setSteps(newSteps);
                        }
                      : undefined
                  }
                  onMoveDown={
                    idx < steps.length - 1
                      ? () => {
                          const newSteps = [...steps];
                          const temp = newSteps[idx];
                          newSteps[idx] = newSteps[idx + 1];
                          newSteps[idx + 1] = temp;
                          setSteps(newSteps);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* Add Next Step Bar */}
          <div className="border-border/60 border-t pt-2">
            <span className="text-foreground mb-2 block text-xs font-semibold">
              + Add Step:
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddAction("QUESTION")}
                className="h-8 cursor-pointer gap-1.5 border-blue-500/30 text-xs text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
              >
                <HelpCircle className="size-3.5" />
                Question with Quick Replies
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddAction("SEND_MESSAGE")}
                className="h-8 cursor-pointer gap-1.5 border-emerald-500/30 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                <MessageSquare className="size-3.5" />
                Send Message
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddAction("SEND_MEDIA")}
                className="h-8 cursor-pointer gap-1.5 border-purple-500/30 text-xs text-purple-600 hover:bg-purple-500/10 dark:text-purple-400"
              >
                <FileText className="size-3.5" />
                Send PDF / Media
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddAction("CALL_API")}
                className="h-8 cursor-pointer gap-1.5 border-cyan-500/30 text-xs text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-400"
              >
                <Globe className="size-3.5" />
                Call API / Webhook
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddAction("UPDATE_CUSTOMER")}
                className="h-8 cursor-pointer gap-1.5 border-orange-500/30 text-xs text-orange-600 hover:bg-orange-500/10 dark:text-orange-400"
              >
                <UserCheck className="size-3.5" />
                Update Customer Info
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddAction("WAIT_DELAY")}
                className="h-8 cursor-pointer gap-1.5 border-amber-500/30 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
              >
                <Clock className="size-3.5" />
                Wait Delay
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Link href="/workflows">
            <Button variant="ghost" size="sm" className="h-9 text-xs">
              Cancel
            </Button>
          </Link>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-cf-orange hover:bg-cf-orange/90 h-9 cursor-pointer gap-1.5 px-5 text-xs font-semibold text-white shadow-xs"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <span>{isNew ? "Create Workflow" : "Save Changes"}</span>
          </Button>
        </div>
      </div>

      {/* Test Live Workflow Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="border-border bg-card w-full max-w-md space-y-4 rounded-xl border p-5 shadow-xl">
            <div className="border-border/60 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Play className="size-4 text-emerald-500" />
                <h3 className="text-foreground text-sm font-semibold">
                  Test Workflow
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-muted-foreground text-xs">
              Select a customer to trigger this workflow for immediately. The
              customer will receive the first step on WhatsApp.
            </p>

            {isLoadingCustomers ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="text-cf-orange size-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-foreground block text-xs font-medium">
                  Select Target Customer:
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
                onClick={() => setShowTestModal(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRunTest}
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
    </div>
  );
}
