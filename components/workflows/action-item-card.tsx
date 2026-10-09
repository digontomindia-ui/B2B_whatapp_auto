"use client";

import {
  HelpCircle,
  MessageSquare,
  FileText,
  Clock,
  UserCheck,
  Globe,
  GitFork,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  ArrowDown
} from "lucide-react";
import {
  WorkflowAction,
  WorkflowActionType,
  QuickReplyOption,
  QuestionConfig,
  SendMessageConfig,
  SendMediaConfig,
  WaitDelayConfig,
  UpdateCustomerConfig,
  CallApiConfig,
  StartWorkflowConfig
} from "./types";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ActionItemCardProps {
  action: WorkflowAction;
  index: number;
  total: number;
  onChange: (updated: WorkflowAction) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isNested?: boolean;
}

const ACTION_ICONS: Record<WorkflowActionType, React.ElementType> = {
  QUESTION: HelpCircle,
  SEND_MESSAGE: MessageSquare,
  SEND_MEDIA: FileText,
  WAIT_DELAY: Clock,
  UPDATE_CUSTOMER: UserCheck,
  CALL_API: Globe,
  START_WORKFLOW: GitFork
};

const ACTION_NAMES: Record<WorkflowActionType, string> = {
  QUESTION: "Question & Quick Replies",
  SEND_MESSAGE: "Send WhatsApp Message",
  SEND_MEDIA: "Send PDF / Media",
  WAIT_DELAY: "Wait Delay",
  UPDATE_CUSTOMER: "Update Customer Info",
  CALL_API: "Call External API / Webhook",
  START_WORKFLOW: "Start Another Workflow"
};

const ACTION_COLORS: Record<WorkflowActionType, string> = {
  QUESTION: "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400",
  SEND_MESSAGE:
    "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  SEND_MEDIA:
    "border-purple-500/30 bg-purple-500/5 text-purple-600 dark:text-purple-400",
  WAIT_DELAY:
    "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  UPDATE_CUSTOMER:
    "border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400",
  CALL_API: "border-cyan-500/30 bg-cyan-500/5 text-cyan-600 dark:text-cyan-400",
  START_WORKFLOW:
    "border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400"
};

export function ActionItemCard({
  action,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isNested = false
}: ActionItemCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const Icon = ACTION_ICONS[action.type] || MessageSquare;

  const questionConfig = (action.config || {}) as unknown as QuestionConfig;
  const messageConfig = (action.config || {}) as unknown as SendMessageConfig;
  const mediaConfig = (action.config || {}) as unknown as SendMediaConfig;
  const delayConfig = (action.config || {}) as unknown as WaitDelayConfig;
  const customerConfig = (action.config ||
    {}) as unknown as UpdateCustomerConfig;
  const apiConfig = (action.config || {}) as unknown as CallApiConfig;
  const workflowConfig = (action.config ||
    {}) as unknown as StartWorkflowConfig;

  const updateConfig = (key: string, value: unknown) => {
    onChange({
      ...action,
      config: {
        ...action.config,
        [key]: value
      }
    });
  };

  const handleInsertVariable = (fieldKey: string, variableText: string) => {
    const current = (action.config[fieldKey] as string) || "";
    updateConfig(fieldKey, `${current}${variableText}`);
  };

  return (
    <div
      className={`rounded-lg border transition-all ${
        isNested
          ? "border-border/70 bg-card/60 shadow-xs"
          : "border-border bg-card shadow-xs"
      }`}
    >
      {/* Action Card Header */}
      <div className="border-border/50 bg-muted/20 flex items-center justify-between border-b p-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-7 items-center justify-center rounded-md border ${
              ACTION_COLORS[action.type]
            }`}
          >
            <Icon className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-xs">
                #{index + 1}
              </span>
              <span className="text-foreground text-xs font-semibold">
                {ACTION_NAMES[action.type]}
              </span>
            </div>
            {action.type === "QUESTION" && Boolean(questionConfig.bodyText) && (
              <p className="text-muted-foreground max-w-sm truncate text-[11px]">
                &ldquo;{questionConfig.bodyText}&rdquo;
              </p>
            )}
            {action.type === "SEND_MESSAGE" && Boolean(messageConfig.text) && (
              <p className="text-muted-foreground max-w-sm truncate text-[11px]">
                &ldquo;{messageConfig.text}&rdquo;
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onMoveUp && index > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-7"
              onClick={onMoveUp}
              title="Move up"
            >
              <ChevronUp className="size-3.5" />
            </Button>
          )}
          {onMoveDown && index < total - 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-7"
              onClick={onMoveDown}
              title="Move down"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10 size-7"
            onClick={onDelete}
            title="Delete action"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-7"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={`size-3.5 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </Button>
        </div>
      </div>

      {/* Action Card Body */}
      {isExpanded && (
        <div className="space-y-4 p-4 text-xs">
          {/* 1. QUESTION WITH QUICK REPLIES */}
          {action.type === "QUESTION" && (
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-foreground font-medium">
                    Question Text <span className="text-destructive">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[10px]">
                      Variables:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleInsertVariable("bodyText", " {{customer.name}}")
                      }
                      className="bg-muted hover:bg-muted/80 text-cf-orange cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px]"
                    >
                      + Name
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleInsertVariable(
                          "bodyText",
                          " {{customer.phoneNumber}}"
                        )
                      }
                      className="bg-muted hover:bg-muted/80 text-cf-orange cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px]"
                    >
                      + Phone
                    </button>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={questionConfig.bodyText || ""}
                  onChange={(e) => updateConfig("bodyText", e.target.value)}
                  placeholder="e.g. What is your gender?"
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-xs focus-visible:ring-1 focus-visible:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-foreground mb-1 block font-medium">
                    Header (optional)
                  </label>
                  <Input
                    value={questionConfig.headerText || ""}
                    onChange={(e) => updateConfig("headerText", e.target.value)}
                    placeholder="e.g. Quick Question"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-foreground mb-1 block font-medium">
                    Footer (optional)
                  </label>
                  <Input
                    value={questionConfig.footerText || ""}
                    onChange={(e) => updateConfig("footerText", e.target.value)}
                    placeholder="e.g. Select an option below"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Quick Reply Buttons (Branches) */}
              <div className="border-border/60 space-y-3 border-t pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-foreground font-semibold">
                      Quick Reply Buttons
                    </span>
                    <span className="text-muted-foreground ml-2 text-[11px]">
                      (Max 3 buttons. Define what happens when clicked)
                    </span>
                  </div>

                  {(questionConfig.options || []).length < 3 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const current = questionConfig.options || [];
                        const newOpt: QuickReplyOption = {
                          id: `btn_${Date.now()}`,
                          title: `Option ${current.length + 1}`,
                          actions: []
                        };
                        updateConfig("options", [...current, newOpt]);
                      }}
                      className="h-7 gap-1 text-xs"
                    >
                      <Plus className="size-3" /> Add Button
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {(questionConfig.options || []).map(
                    (opt: QuickReplyOption, optIdx: number) => (
                      <div
                        key={opt.id || optIdx}
                        className="border-border/80 bg-background/50 space-y-3 rounded-lg border p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-1 items-center gap-2">
                            <span className="bg-cf-orange/15 text-cf-orange flex size-5 items-center justify-center rounded-full text-[10px] font-bold">
                              {optIdx + 1}
                            </span>
                            <div className="max-w-xs flex-1">
                              <Input
                                value={opt.title}
                                maxLength={20}
                                onChange={(e) => {
                                  const newOpts = [
                                    ...(questionConfig.options || [])
                                  ];
                                  newOpts[optIdx] = {
                                    ...newOpts[optIdx],
                                    title: e.target.value
                                  };
                                  updateConfig("options", newOpts);
                                }}
                                placeholder="Button title (max 20 chars)"
                                className="h-7 text-xs font-medium"
                              />
                            </div>
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {opt.title?.length || 0}/20
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 size-6"
                            onClick={() => {
                              const newOpts = (
                                questionConfig.options || []
                              ).filter((_, i: number) => i !== optIdx);
                              updateConfig("options", newOpts);
                            }}
                            title="Remove button"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>

                        {/* Branch Actions */}
                        <div className="border-cf-orange/30 space-y-2 border-l-2 pl-6">
                          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
                            <ArrowDown className="text-cf-orange size-3" />
                            <span>
                              When customer clicks &ldquo;
                              {opt.title || "this button"}&rdquo; → do:
                            </span>
                          </div>

                          {/* List of actions for this option */}
                          <div className="space-y-2">
                            {(opt.actions || []).map(
                              (subAction: WorkflowAction, subIdx: number) => (
                                <ActionItemCard
                                  key={subAction.id || subIdx}
                                  action={subAction}
                                  index={subIdx}
                                  total={(opt.actions || []).length}
                                  isNested={true}
                                  onChange={(updatedSub) => {
                                    const newOpts = [
                                      ...(questionConfig.options || [])
                                    ];
                                    const newActions = [
                                      ...(newOpts[optIdx].actions || [])
                                    ];
                                    newActions[subIdx] = updatedSub;
                                    newOpts[optIdx].actions = newActions;
                                    updateConfig("options", newOpts);
                                  }}
                                  onDelete={() => {
                                    const newOpts = [
                                      ...(questionConfig.options || [])
                                    ];
                                    newOpts[optIdx].actions = (
                                      newOpts[optIdx].actions || []
                                    ).filter((_, i: number) => i !== subIdx);
                                    updateConfig("options", newOpts);
                                  }}
                                  onMoveUp={
                                    subIdx > 0
                                      ? () => {
                                          const newOpts = [
                                            ...(questionConfig.options || [])
                                          ];
                                          const newActions = [
                                            ...(newOpts[optIdx].actions || [])
                                          ];
                                          const temp = newActions[subIdx];
                                          newActions[subIdx] =
                                            newActions[subIdx - 1];
                                          newActions[subIdx - 1] = temp;
                                          newOpts[optIdx].actions = newActions;
                                          updateConfig("options", newOpts);
                                        }
                                      : undefined
                                  }
                                  onMoveDown={
                                    subIdx < (opt.actions || []).length - 1
                                      ? () => {
                                          const newOpts = [
                                            ...(questionConfig.options || [])
                                          ];
                                          const newActions = [
                                            ...(newOpts[optIdx].actions || [])
                                          ];
                                          const temp = newActions[subIdx];
                                          newActions[subIdx] =
                                            newActions[subIdx + 1];
                                          newActions[subIdx + 1] = temp;
                                          newOpts[optIdx].actions = newActions;
                                          updateConfig("options", newOpts);
                                        }
                                      : undefined
                                  }
                                />
                              )
                            )}

                            {/* Add Action to this branch selector */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-muted-foreground mr-1 text-[10px]">
                                + Add Next Action:
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newSub: WorkflowAction = {
                                    id: `act_${Date.now()}`,
                                    type: "SEND_MESSAGE",
                                    config: { text: "" }
                                  };
                                  const newOpts = [
                                    ...(questionConfig.options || [])
                                  ];
                                  newOpts[optIdx].actions = [
                                    ...(newOpts[optIdx].actions || []),
                                    newSub
                                  ];
                                  updateConfig("options", newOpts);
                                }}
                                className="h-6 cursor-pointer gap-1 px-2 text-[10px]"
                              >
                                <MessageSquare className="size-2.5 text-emerald-500" />
                                Send Message
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newSub: WorkflowAction = {
                                    id: `act_${Date.now()}`,
                                    type: "SEND_MEDIA",
                                    config: {
                                      mediaType: "DOCUMENT",
                                      mediaUrl: "",
                                      fileName: "document.pdf"
                                    }
                                  };
                                  const newOpts = [
                                    ...(questionConfig.options || [])
                                  ];
                                  newOpts[optIdx].actions = [
                                    ...(newOpts[optIdx].actions || []),
                                    newSub
                                  ];
                                  updateConfig("options", newOpts);
                                }}
                                className="h-6 cursor-pointer gap-1 px-2 text-[10px]"
                              >
                                <FileText className="size-2.5 text-purple-500" />
                                Send PDF / Media
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newSub: WorkflowAction = {
                                    id: `act_${Date.now()}`,
                                    type: "CALL_API",
                                    config: {
                                      method: "POST",
                                      url: "",
                                      bodyJson: '{\n  "reply": "{{reply}}"\n}'
                                    }
                                  };
                                  const newOpts = [
                                    ...(questionConfig.options || [])
                                  ];
                                  newOpts[optIdx].actions = [
                                    ...(newOpts[optIdx].actions || []),
                                    newSub
                                  ];
                                  updateConfig("options", newOpts);
                                }}
                                className="h-6 cursor-pointer gap-1 px-2 text-[10px]"
                              >
                                <Globe className="size-2.5 text-cyan-500" />
                                Call API
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newSub: WorkflowAction = {
                                    id: `act_${Date.now()}`,
                                    type: "UPDATE_CUSTOMER",
                                    config: {
                                      metadata: {
                                        gender: opt.title
                                      }
                                    }
                                  };
                                  const newOpts = [
                                    ...(questionConfig.options || [])
                                  ];
                                  newOpts[optIdx].actions = [
                                    ...(newOpts[optIdx].actions || []),
                                    newSub
                                  ];
                                  updateConfig("options", newOpts);
                                }}
                                className="h-6 cursor-pointer gap-1 px-2 text-[10px]"
                              >
                                <UserCheck className="size-2.5 text-orange-500" />
                                Update Customer
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newSub: WorkflowAction = {
                                    id: `act_${Date.now()}`,
                                    type: "WAIT_DELAY",
                                    config: { delaySeconds: 2 }
                                  };
                                  const newOpts = [
                                    ...(questionConfig.options || [])
                                  ];
                                  newOpts[optIdx].actions = [
                                    ...(newOpts[optIdx].actions || []),
                                    newSub
                                  ];
                                  updateConfig("options", newOpts);
                                }}
                                className="h-6 cursor-pointer gap-1 px-2 text-[10px]"
                              >
                                <Clock className="size-2.5 text-amber-500" />
                                Wait Delay
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. SEND MESSAGE */}
          {action.type === "SEND_MESSAGE" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-foreground font-medium">
                  Message Text <span className="text-destructive">*</span>
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-[10px]">
                    Variables:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleInsertVariable("text", " {{customer.name}}")
                    }
                    className="bg-muted hover:bg-muted/80 text-cf-orange cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    + Name
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleInsertVariable("text", " {{customer.phoneNumber}}")
                    }
                    className="bg-muted hover:bg-muted/80 text-cf-orange cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    + Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable("text", " {{reply}}")}
                    className="bg-muted hover:bg-muted/80 text-cf-orange cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    + Reply
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={messageConfig.text || ""}
                onChange={(e) => updateConfig("text", e.target.value)}
                placeholder="Type your message here... e.g. Hello {{customer.name}}, welcome!"
                className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-xs focus-visible:ring-1 focus-visible:outline-none"
              />
            </div>
          )}

          {/* 3. SEND MEDIA */}
          {action.type === "SEND_MEDIA" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-foreground mb-1 block font-medium">
                    Media Type
                  </label>
                  <select
                    value={mediaConfig.mediaType || "DOCUMENT"}
                    onChange={(e) => updateConfig("mediaType", e.target.value)}
                    className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-2.5 py-1.5 text-xs focus-visible:ring-1 focus-visible:outline-none"
                  >
                    <option value="DOCUMENT">Document (PDF)</option>
                    <option value="IMAGE">Image</option>
                    <option value="VIDEO">Video</option>
                    <option value="AUDIO">Audio</option>
                  </select>
                </div>

                <div>
                  <label className="text-foreground mb-1 block font-medium">
                    File Name (e.g. brochure.pdf)
                  </label>
                  <Input
                    value={mediaConfig.fileName || ""}
                    onChange={(e) => updateConfig("fileName", e.target.value)}
                    placeholder="brochure.pdf"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-foreground mb-1 block font-medium">
                  Public Media URL <span className="text-destructive">*</span>
                </label>
                <Input
                  value={mediaConfig.mediaUrl || ""}
                  onChange={(e) => updateConfig("mediaUrl", e.target.value)}
                  placeholder="https://example.com/assets/brochure.pdf"
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-foreground mb-1 block font-medium">
                  Caption (optional)
                </label>
                <Input
                  value={mediaConfig.caption || ""}
                  onChange={(e) => updateConfig("caption", e.target.value)}
                  placeholder="Here is the PDF you requested!"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* 4. WAIT DELAY */}
          {action.type === "WAIT_DELAY" && (
            <div className="flex items-center gap-3">
              <label className="text-foreground font-medium">
                Wait duration (seconds):
              </label>
              <Input
                type="number"
                min={1}
                max={60}
                value={delayConfig.delaySeconds ?? 3}
                onChange={(e) =>
                  updateConfig(
                    "delaySeconds",
                    parseInt(e.target.value, 10) || 1
                  )
                }
                className="h-8 w-24 text-xs"
              />
              <span className="text-muted-foreground text-[11px]">
                Pauses the workflow for this many seconds before the next step.
              </span>
            </div>
          )}

          {/* 5. UPDATE CUSTOMER */}
          {action.type === "UPDATE_CUSTOMER" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-foreground mb-1 block font-medium">
                    Add Tags (comma-separated)
                  </label>
                  <Input
                    value={
                      Array.isArray(customerConfig.addTags)
                        ? customerConfig.addTags.join(", ")
                        : customerConfig.addTags || ""
                    }
                    onChange={(e) =>
                      updateConfig(
                        "addTags",
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder="e.g. VIP, Interested, Male"
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <label className="text-foreground mb-1 block font-medium">
                    Status State
                  </label>
                  <select
                    value={customerConfig.state || ""}
                    onChange={(e) =>
                      updateConfig("state", e.target.value || undefined)
                    }
                    className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-2.5 py-1.5 text-xs focus-visible:ring-1 focus-visible:outline-none"
                  >
                    <option value="">(Keep unchanged)</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="OPTED_OUT">OPTED_OUT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-foreground mb-1 block font-medium">
                  Append Note (optional)
                </label>
                <Input
                  value={customerConfig.notes || ""}
                  onChange={(e) => updateConfig("notes", e.target.value)}
                  placeholder="e.g. Selected {{reply}} on workflow"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-foreground mb-1 block font-medium">
                  Save Attribute to Metadata (JSON)
                </label>
                <textarea
                  rows={2}
                  value={
                    typeof customerConfig.metadata === "object"
                      ? JSON.stringify(customerConfig.metadata, null, 2)
                      : customerConfig.metadata || ""
                  }
                  onChange={(e) => {
                    try {
                      updateConfig("metadata", JSON.parse(e.target.value));
                    } catch {
                      updateConfig("metadata", e.target.value);
                    }
                  }}
                  placeholder='{ "gender": "{{reply}}" }'
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs focus-visible:ring-1 focus-visible:outline-none"
                />
              </div>
            </div>
          )}

          {/* 6. CALL API */}
          {action.type === "CALL_API" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-foreground mb-1 block font-medium">
                    HTTP Method
                  </label>
                  <select
                    value={apiConfig.method || "POST"}
                    onChange={(e) => updateConfig("method", e.target.value)}
                    className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-2.5 py-1.5 text-xs focus-visible:ring-1 focus-visible:outline-none"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-foreground mb-1 block font-medium">
                    Webhook Endpoint URL{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={apiConfig.url || ""}
                    onChange={(e) => updateConfig("url", e.target.value)}
                    placeholder="https://api.example.com/webhook"
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>

              {apiConfig.method !== "GET" && (
                <div>
                  <label className="text-foreground mb-1 block font-medium">
                    JSON Payload Body (supports variables)
                  </label>
                  <textarea
                    rows={4}
                    value={apiConfig.bodyJson || ""}
                    onChange={(e) => updateConfig("bodyJson", e.target.value)}
                    placeholder='{\n  "phone": "{{customer.phoneNumber}}",\n  "reply": "{{reply}}"\n}'
                    className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs focus-visible:ring-1 focus-visible:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* 7. START WORKFLOW */}
          {action.type === "START_WORKFLOW" && (
            <div>
              <label className="text-foreground mb-1 block font-medium">
                Target Workflow ID
              </label>
              <Input
                value={workflowConfig.workflowId || ""}
                onChange={(e) => updateConfig("workflowId", e.target.value)}
                placeholder="Paste Target Workflow ID"
                className="h-8 font-mono text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
