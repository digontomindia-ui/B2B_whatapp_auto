"use client";

import {
  ArrowLeft,
  Layers,
  Sparkles,
  Send,
  Loader2,
  Lock,
  Plus,
  Trash2,
  CheckCheck,
  ExternalLink,
  Phone,
  MessageSquare,
  Image as ImageIcon,
  Video,
  FileText,
  HelpCircle,
  Smartphone,
  Info,
  User,
  Pin,
  X,
  Settings2,
  Check
} from "lucide-react";
import React, { useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { toast } from "sonner";

// Supported WhatsApp languages
const SUPPORTED_LANGUAGES = [
  { code: "en_US", name: "English (US)" },
  { code: "en_GB", name: "English (UK)" },
  { code: "hi", name: "Hindi (हिन्दी)" },
  { code: "es", name: "Spanish (Español)" },
  { code: "ar", name: "Arabic (العربية)" },
  { code: "bn", name: "Bengali (বাংলা)" },
  { code: "ta", name: "Tamil (தமிழ்)" },
  { code: "te", name: "Telugu (తెలుగు)" },
  { code: "mr", name: "Marathi (मराठी)" },
  { code: "gu", name: "Gujarati (ગુજરાતી)" },
  { code: "kn", name: "Kannada (ಕನ್ನಡ)" },
  { code: "ml", name: "Malayalam (മലയാളം)" },
  { code: "pa", name: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "ur", name: "Urdu (اردو)" },
  { code: "fr", name: "French (Français)" },
  { code: "de", name: "German (Deutsch)" },
  { code: "ru", name: "Russian (Русский)" },
  { code: "pt_BR", name: "Portuguese (BR)" },
  { code: "id", name: "Indonesian (Bahasa Indonesia)" }
];

type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
type ButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
export type VariableType = "dynamic" | "static";

export interface VariableConfig {
  type: VariableType;
  field: string;
  customField: string;
  sample: string;
  fallback: string;
  staticValue: string;
}

export const DYNAMIC_CRM_FIELDS = [
  {
    key: "customer.customName",
    label: "customer.customName",
    description: "Custom contact display name in CRM",
    defaultSample: "Rajesh Sharma",
    defaultFallback: "Parent"
  },
  {
    key: "customer.name",
    label: "customer.name",
    description: "Full contact name (display or profile)",
    defaultSample: "Rajesh Sharma",
    defaultFallback: "Customer"
  },
  {
    key: "customer.whatsappName",
    label: "customer.whatsappName",
    description: "Customer's public WhatsApp profile name",
    defaultSample: "Alex Johnson",
    defaultFallback: "Customer"
  },
  {
    key: "customer.phoneNumber",
    label: "customer.phoneNumber",
    description: "Customer's phone number",
    defaultSample: "+91 98765 43210",
    defaultFallback: ""
  },
  {
    key: "customer.about",
    label: "customer.about",
    description: "Customer WhatsApp About / Status",
    defaultSample: "Parent of Class 10th Student",
    defaultFallback: "Member"
  },
  {
    key: "customer.notes",
    label: "customer.notes",
    description: "Internal CRM staff notes",
    defaultSample: "Class 10-A",
    defaultFallback: ""
  },
  {
    key: "custom",
    label: "Custom Attribute (User Defined)...",
    description:
      "Any custom CRM attribute (e.g. customer.student_name, customer.fee_due)",
    defaultSample: "Sample Value",
    defaultFallback: ""
  }
];

interface TemplateButtonInput {
  id: string;
  type: ButtonType;
  text: string;
  url?: string;
  phoneNumber?: string;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const { hasPermission, isOwner } = useAuth();
  const canCreate = isOwner || hasPermission(PERMISSIONS.TEMPLATE_CREATE);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState<
    "MARKETING" | "UTILITY" | "AUTHENTICATION"
  >("MARKETING");
  const [language, setLanguage] = useState("en_US");

  // Header State
  const [headerType, setHeaderType] = useState<HeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerVarConfig, setHeaderVarConfig] = useState<VariableConfig>({
    type: "static",
    field: "custom",
    customField: "school.name",
    sample: "Annual Day 2026",
    fallback: "",
    staticValue: "Annual Day 2026"
  });

  // Body State
  const [bodyText, setBodyText] = useState("");
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Variable Mappings State: Record<string, VariableConfig>
  const [variableConfigs, setVariableConfigs] = useState<
    Record<string, VariableConfig>
  >({});

  // Footer State
  const [footerText, setFooterText] = useState("");

  // Buttons State
  const [buttons, setButtons] = useState<TemplateButtonInput[]>([]);

  // Preview Mode: "samples" | "fields" | "raw"
  const [previewMode, setPreviewMode] = useState<"samples" | "fields" | "raw">(
    "samples"
  );

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State for variable configuration
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configModalTarget, setConfigModalTarget] = useState<{
    target: "body" | "header";
    index: number;
    isNew: boolean;
  }>({ target: "body", index: 1, isNew: true });

  const [modalForm, setModalForm] = useState<VariableConfig>({
    type: "dynamic",
    field: "customer.customName",
    customField: "",
    sample: "Rajesh Sharma",
    fallback: "Parent",
    staticValue: ""
  });

  // Extract variables like {{1}}, {{2}} from body
  const bodyVariables = useMemo(() => {
    const matches = Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g));
    const uniqueKeys = Array.from(new Set(matches.map((m) => m[1])));
    return uniqueKeys.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [bodyText]);

  // Helper to get effective config for a variable
  const getEffectiveConfig = useCallback(
    (v: string): VariableConfig => {
      if (variableConfigs[v]) {
        return variableConfigs[v];
      }
      const idx = parseInt(v, 10);
      return {
        type: "dynamic",
        field: idx === 1 ? "customer.customName" : "customer.name",
        customField: "",
        sample: idx === 1 ? "Rajesh Sharma" : `Sample ${v}`,
        fallback: idx === 1 ? "Parent" : "Customer",
        staticValue: ""
      };
    },
    [variableConfigs]
  );

  // Update a variable config in state
  function updateVariableConfig(v: string, updates: Partial<VariableConfig>) {
    setVariableConfigs((prev) => {
      const current = prev[v] || getEffectiveConfig(v);
      return {
        ...prev,
        [v]: {
          ...current,
          ...updates
        }
      };
    });
  }

  // Open modal to add a new variable
  function handleOpenAddVariableModal() {
    const existingIndices = bodyVariables.map((v) => parseInt(v, 10));
    const nextIndex =
      existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 1;

    setConfigModalTarget({
      target: "body",
      index: nextIndex,
      isNew: true
    });

    setModalForm({
      type: "dynamic",
      field: nextIndex === 1 ? "customer.customName" : "customer.name",
      customField: "",
      sample: nextIndex === 1 ? "Rajesh Sharma" : `Sample ${nextIndex}`,
      fallback: nextIndex === 1 ? "Parent" : "Customer",
      staticValue: ""
    });

    setIsConfigModalOpen(true);
  }

  // Open modal to edit existing variable
  function handleOpenEditVariableModal(v: string) {
    const idx = parseInt(v, 10);
    const cfg = getEffectiveConfig(v);
    setConfigModalTarget({
      target: "body",
      index: idx,
      isNew: false
    });
    setModalForm({ ...cfg });
    setIsConfigModalOpen(true);
  }

  // Open modal for header variable
  function handleOpenHeaderVarModal() {
    setConfigModalTarget({
      target: "header",
      index: 1,
      isNew: false
    });
    setModalForm({ ...headerVarConfig });
    setIsConfigModalOpen(true);
  }

  // Save/Confirm variable modal
  function handleConfirmVariableModal() {
    const { target, index, isNew } = configModalTarget;

    if (modalForm.type === "static") {
      if (!modalForm.staticValue.trim()) {
        toast.error("Please enter a static text value");
        return;
      }
    } else {
      if (modalForm.field === "custom" && !modalForm.customField.trim()) {
        toast.error("Please enter a user-defined attribute name");
        return;
      }
      if (!modalForm.sample.trim()) {
        toast.error("Meta requires a sample value for template approval");
        return;
      }
    }

    const finalConfig: VariableConfig = {
      ...modalForm,
      sample:
        modalForm.type === "static"
          ? modalForm.staticValue.trim()
          : modalForm.sample.trim(),
      staticValue:
        modalForm.type === "static" ? modalForm.staticValue.trim() : "",
      customField:
        modalForm.field === "custom" ? modalForm.customField.trim() : ""
    };

    if (target === "header") {
      setHeaderVarConfig(finalConfig);
    } else {
      setVariableConfigs((prev) => ({
        ...prev,
        [String(index)]: finalConfig
      }));

      if (isNew) {
        // Insert variable tag {{index}} at cursor position
        const textarea = bodyTextareaRef.current;
        const varTag = `{{${index}}}`;
        if (textarea) {
          const start = textarea.selectionStart || 0;
          const end = textarea.selectionEnd || 0;
          const newText =
            bodyText.substring(0, start) + varTag + bodyText.substring(end);
          setBodyText(newText);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(
              start + varTag.length,
              start + varTag.length
            );
          }, 0);
        } else {
          setBodyText((prev) => `${prev} ${varTag}`.trim());
        }
      }
    }

    setIsConfigModalOpen(false);
    toast.success(
      isNew
        ? `Variable {{${index}}} configured and added!`
        : `Variable {{${index}}} updated!`
    );
  }

  // Formatting helpers
  function wrapSelectionWith(syntax: string) {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const selected = bodyText.substring(start, end) || "text";
    const wrapped = `${syntax}${selected}${syntax}`;

    const newText =
      bodyText.substring(0, start) + wrapped + bodyText.substring(end);
    setBodyText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + syntax.length,
        start + wrapped.length - syntax.length
      );
    }, 0);
  }

  // Add button handler
  function handleAddButton(type: ButtonType) {
    if (buttons.length >= 3) {
      toast.error("Meta allows a maximum of 3 buttons per template");
      return;
    }

    const newBtn: TemplateButtonInput = {
      id: crypto.randomUUID(),
      type,
      text:
        type === "QUICK_REPLY"
          ? "Quick Reply"
          : type === "URL"
            ? "Visit Website"
            : "Call Us",
      url: type === "URL" ? "https://myschoolbranding.com" : undefined,
      phoneNumber: type === "PHONE_NUMBER" ? "+919876543210" : undefined
    };

    setButtons([...buttons, newBtn]);
  }

  function handleRemoveButton(id: string) {
    setButtons(buttons.filter((b) => b.id !== id));
  }

  function handleUpdateButton(
    id: string,
    updates: Partial<TemplateButtonInput>
  ) {
    setButtons(buttons.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }

  // Render preview body text
  const previewBodyFormatted = useMemo(() => {
    if (!bodyText.trim()) {
      return (
        <span className="text-muted-foreground italic">
          Message body text will appear here...
        </span>
      );
    }

    let textToRender = bodyText;

    if (previewMode === "samples") {
      for (const k of bodyVariables) {
        const cfg = getEffectiveConfig(k);
        const val =
          cfg.type === "static"
            ? cfg.staticValue || cfg.sample || `{{${k}}}`
            : cfg.sample || `{{${k}}}`;
        textToRender = textToRender.replace(
          new RegExp(`\\{\\{${k}\\}\\}`, "g"),
          val
        );
      }
    } else if (previewMode === "fields") {
      for (const k of bodyVariables) {
        const cfg = getEffectiveConfig(k);
        const val =
          cfg.type === "static"
            ? `{{Static: "${cfg.staticValue || cfg.sample}"}}`
            : `{{${cfg.field === "custom" ? cfg.customField || "user_attribute" : cfg.field}}}`;
        textToRender = textToRender.replace(
          new RegExp(`\\{\\{${k}\\}\\}`, "g"),
          val
        );
      }
    }
    // "raw" mode keeps {{1}}, {{2}} untouched

    return textToRender;
  }, [bodyText, previewMode, bodyVariables, getEffectiveConfig]);

  // Live preview header text
  const previewHeader = useMemo(() => {
    if (headerType === "NONE") return null;
    if (headerType === "TEXT") {
      let t = headerText || "Header Title";
      if (headerText.includes("{{1}}")) {
        if (previewMode === "samples") {
          const val =
            headerVarConfig.type === "static"
              ? headerVarConfig.staticValue || headerVarConfig.sample
              : headerVarConfig.sample;
          t = t.replace(/\{\{1\}\}/g, val.trim() || "{{1}}");
        } else if (previewMode === "fields") {
          const val =
            headerVarConfig.type === "static"
              ? `{{Static: "${headerVarConfig.staticValue || headerVarConfig.sample}"}}`
              : `{{${headerVarConfig.field === "custom" ? headerVarConfig.customField || "user_attribute" : headerVarConfig.field}}}`;
          t = t.replace(/\{\{1\}\}/g, val);
        }
      }
      return t;
    }
    return null;
  }, [headerType, headerText, headerVarConfig, previewMode]);

  // Form submission handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cleanName = name.trim().toLowerCase();
    if (!cleanName) {
      toast.error("Template name is required");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanName)) {
      toast.error(
        "Template name can only contain lowercase letters, numbers, and underscores"
      );
      return;
    }

    if (!bodyText.trim()) {
      toast.error("Template body text is required");
      return;
    }

    // Validate body variable samples and static values
    for (const v of bodyVariables) {
      const cfg = getEffectiveConfig(v);
      if (cfg.type === "static" && !cfg.staticValue.trim()) {
        toast.error(`Please provide a static text value for variable {{${v}}}`);
        return;
      }
      if (cfg.type === "dynamic") {
        if (!cfg.sample.trim()) {
          toast.error(`Please provide a sample value for variable {{${v}}}`);
          return;
        }
        if (cfg.field === "custom" && !cfg.customField.trim()) {
          toast.error(
            `Please specify the custom attribute name for variable {{${v}}}`
          );
          return;
        }
      }
    }

    // Validate header variable sample if present
    if (headerType === "TEXT" && headerText.includes("{{1}}")) {
      if (
        headerVarConfig.type === "static" &&
        !headerVarConfig.staticValue.trim()
      ) {
        toast.error("Please provide a static value for header variable {{1}}");
        return;
      }
      if (
        headerVarConfig.type === "dynamic" &&
        !headerVarConfig.sample.trim()
      ) {
        toast.error("Please provide a sample value for header variable {{1}}");
        return;
      }
    }

    // Validate buttons
    for (const btn of buttons) {
      if (!btn.text.trim()) {
        toast.error("All buttons must have label text");
        return;
      }
      if (btn.type === "URL" && !btn.url?.trim()) {
        toast.error(`Please provide a URL for button "${btn.text}"`);
        return;
      }
      if (btn.type === "PHONE_NUMBER" && !btn.phoneNumber?.trim()) {
        toast.error(`Please provide a phone number for button "${btn.text}"`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Build effective variableMappings and examples for Meta
      const finalVariableMappings: Record<string, VariableConfig> = {};
      const bodyExamplesList: string[] = [];

      for (const v of bodyVariables) {
        const cfg = getEffectiveConfig(v);
        finalVariableMappings[v] = cfg;
        bodyExamplesList.push(
          cfg.type === "static"
            ? cfg.staticValue || cfg.sample || "Sample"
            : cfg.sample || "Sample"
        );
      }

      const headerExampleVal =
        headerVarConfig.type === "static"
          ? headerVarConfig.staticValue || headerVarConfig.sample || "Sample"
          : headerVarConfig.sample || "Sample";

      const payload = {
        name: cleanName,
        category,
        language,
        header:
          headerType !== "NONE"
            ? {
                type: headerType,
                text: headerType === "TEXT" ? headerText.trim() : undefined,
                example:
                  headerType === "TEXT" && headerText.includes("{{1}}")
                    ? [headerExampleVal]
                    : undefined,
                variableMapping:
                  headerType === "TEXT" && headerText.includes("{{1}}")
                    ? headerVarConfig
                    : undefined
              }
            : undefined,
        body: {
          text: bodyText.trim(),
          examples: bodyVariables.length > 0 ? bodyExamplesList : undefined,
          variableMappings:
            bodyVariables.length > 0 ? finalVariableMappings : undefined
        },
        footer: footerText.trim() ? { text: footerText.trim() } : undefined,
        buttons:
          buttons.length > 0
            ? buttons.map((b) => ({
                type: b.type,
                text: b.text.trim(),
                url: b.url?.trim(),
                phoneNumber: b.phoneNumber?.trim()
              }))
            : undefined
      };

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to create template on Meta");
      }

      toast.success("Template created and submitted to Meta for approval!");
      router.push("/templates");
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create template";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Access restricted guard
  if (!canCreate) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="bg-destructive/10 text-destructive mb-3 rounded-full p-3">
          <Lock className="size-6" />
        </div>
        <h2 className="text-foreground text-base font-semibold">
          Access Restricted
        </h2>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          You do not have permission to create WhatsApp templates. Contact your
          organization administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden">
      {/* ========================================================= */}
      {/* TOP HEADER BAR */}
      {/* ========================================================= */}
      <div className="border-border bg-card flex shrink-0 items-center justify-between border-b px-6 py-3.5 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/templates"
            className="border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center justify-center rounded-md border p-1.5 transition-colors"
            title="Back to templates"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-foreground text-sm font-bold tracking-tight">
                Create WhatsApp Template
              </h1>
              <span className="bg-cf-orange/10 text-cf-orange border-cf-orange/20 rounded border px-2 py-0.5 text-[10px] font-semibold">
                Meta Cloud API
              </span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Design rich message templates with dynamic customer variable
              mappings and submit directly to Meta.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/templates"
            className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded-md border px-3 py-1.5 text-xs transition-colors"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#e87516] disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="size-3.5" />
                <span>Submit to Meta</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN TWO-COLUMN WORKSPACE */}
      {/* ========================================================= */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT COLUMN: BUILDER FORM */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
            {/* Card 1: Template Basics */}
            <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-xs">
              <div className="border-border flex items-center justify-between border-b pb-2.5">
                <h2 className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                  <Layers className="text-cf-orange size-4" />
                  <span>1. Template Information</span>
                </h2>
                <span className="text-muted-foreground text-[11px]">
                  Required by Meta
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Template Name */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-foreground text-xs font-semibold">
                      Template Name *
                    </label>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      lowercase, numbers &amp; underscores only
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) =>
                      setName(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_")
                      )
                    }
                    placeholder="e.g. admission_confirmation_2026"
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded-md border px-3 py-2 font-mono text-xs focus:ring-1 focus:outline-none"
                  />
                  <p className="text-muted-foreground text-[11px]">
                    Unique identifier on Meta. Once submitted, the name cannot
                    be modified.
                  </p>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-foreground text-xs font-semibold">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(
                        e.target.value as
                          "MARKETING" | "UTILITY" | "AUTHENTICATION"
                      )
                    }
                    className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded-md border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
                  >
                    <option value="MARKETING">
                      Marketing (Promotions, announcements)
                    </option>
                    <option value="UTILITY">
                      Utility (Updates, confirmations, reminders)
                    </option>
                    <option value="AUTHENTICATION">
                      Authentication (OTPs &amp; verification codes)
                    </option>
                  </select>
                </div>

                {/* Language */}
                <div className="space-y-1.5">
                  <label className="text-foreground text-xs font-semibold">
                    Language *
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded-md border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name} ({lang.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: Header Component (Optional) */}
            <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-xs">
              <div className="border-border flex items-center justify-between border-b pb-2.5">
                <h2 className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                  <Sparkles className="text-cf-orange size-4" />
                  <span>2. Header (Optional)</span>
                </h2>
                <span className="text-muted-foreground text-[11px]">
                  Text or Rich Media Banner
                </span>
              </div>

              {/* Format Tabs */}
              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    { type: "NONE", label: "None" },
                    { type: "TEXT", label: "Text" },
                    { type: "IMAGE", label: "Image" },
                    { type: "VIDEO", label: "Video" },
                    { type: "DOCUMENT", label: "Document" }
                  ] as const
                ).map((tab) => {
                  const isActive = headerType === tab.type;
                  return (
                    <button
                      key={tab.type}
                      type="button"
                      onClick={() => setHeaderType(tab.type)}
                      className={`cursor-pointer rounded-md border py-1.5 text-center text-xs font-medium transition-colors ${
                        isActive
                          ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Text Header Input */}
              {headerType === "TEXT" && (
                <div className="space-y-3 pt-1 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-foreground font-semibold">
                        Header Text Content
                      </label>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {headerText.length} / 60
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={60}
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      placeholder="e.g. Annual Sports Meet 2026 {{1}}"
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded-md border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
                    />
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        Supports single variable &#123;&#123;1&#125;&#125;
                      </span>
                      {!headerText.includes("{{1}}") && (
                        <button
                          type="button"
                          onClick={() =>
                            setHeaderText((prev) => `${prev} {{1}}`.trim())
                          }
                          className="text-cf-orange cursor-pointer font-medium hover:underline"
                        >
                          + Insert &#123;&#123;1&#125;&#125;
                        </button>
                      )}
                    </div>
                  </div>

                  {headerText.includes("{{1}}") && (
                    <div className="border-border bg-muted/20 space-y-2.5 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-cf-orange/10 text-cf-orange rounded px-1.5 py-0.5 font-mono text-xs font-bold">
                            &#123;&#123;1&#125;&#125;
                          </span>
                          <span className="text-foreground text-xs font-semibold">
                            Header Variable Mapping
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenHeaderVarModal}
                          className="text-cf-orange flex cursor-pointer items-center gap-1 text-[11px] font-medium hover:underline"
                        >
                          <Settings2 className="size-3" />
                          <span>Configure</span>
                        </button>
                      </div>

                      {/* Quick Type Selection */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setHeaderVarConfig((prev) => ({
                              ...prev,
                              type: "dynamic"
                            }))
                          }
                          className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border py-1.5 ${
                            headerVarConfig.type === "dynamic"
                              ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <User className="size-3" />
                          <span>Dynamic (CRM Field)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setHeaderVarConfig((prev) => ({
                              ...prev,
                              type: "static"
                            }))
                          }
                          className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border py-1.5 ${
                            headerVarConfig.type === "static"
                              ? "border-amber-500 bg-amber-500/10 font-semibold text-amber-600 dark:text-amber-400"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <Pin className="size-3" />
                          <span>Static (Fixed Value)</span>
                        </button>
                      </div>

                      {/* Header Variable Configuration Form */}
                      {headerVarConfig.type === "dynamic" ? (
                        <div className="space-y-2 text-xs">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <label className="text-muted-foreground text-[11px]">
                                CRM Attribute
                              </label>
                              <select
                                value={headerVarConfig.field}
                                onChange={(e) =>
                                  setHeaderVarConfig((prev) => ({
                                    ...prev,
                                    field: e.target.value
                                  }))
                                }
                                className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
                              >
                                {DYNAMIC_CRM_FIELDS.map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {f.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-muted-foreground text-[11px]">
                                Meta Sample Value *
                              </label>
                              <input
                                type="text"
                                value={headerVarConfig.sample}
                                onChange={(e) =>
                                  setHeaderVarConfig((prev) => ({
                                    ...prev,
                                    sample: e.target.value
                                  }))
                                }
                                placeholder="e.g. Class 10th"
                                className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs">
                          <label className="text-muted-foreground text-[11px]">
                            Fixed Value *
                          </label>
                          <input
                            type="text"
                            value={headerVarConfig.staticValue}
                            onChange={(e) =>
                              setHeaderVarConfig((prev) => ({
                                ...prev,
                                staticValue: e.target.value,
                                sample: e.target.value
                              }))
                            }
                            placeholder="e.g. Greenfield Public School"
                            className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Media Header Explanation */}
              {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) && (
                <div className="border-border bg-muted/20 flex items-start gap-2.5 rounded-lg border p-3 text-xs">
                  <Info className="text-cf-orange mt-0.5 size-4 shrink-0" />
                  <div className="text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">
                      {headerType === "IMAGE"
                        ? "Image Banner"
                        : headerType === "VIDEO"
                          ? "Video Clip"
                          : "PDF Document"}
                    </strong>{" "}
                    header will be defined for this template. The actual media
                    file URL or attachment is provided when sending messages to
                    individual contacts or during broadcast.
                  </div>
                </div>
              )}
            </div>

            {/* Card 3: Body & Variables (Required) */}
            <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-xs">
              <div className="border-border flex items-center justify-between border-b pb-2.5">
                <h2 className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                  <MessageSquare className="text-cf-orange size-4" />
                  <span>3. Message Body &amp; Variables (Required)</span>
                </h2>
                <span className="text-muted-foreground font-mono text-[11px]">
                  {bodyText.length} / 1024
                </span>
              </div>

              {/* Formatting and variable tools */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => wrapSelectionWith("*")}
                    className="border-border bg-background text-foreground hover:bg-muted cursor-pointer rounded border px-2 py-1 text-xs font-bold"
                    title="Bold (*text*)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelectionWith("_")}
                    className="border-border bg-background text-foreground hover:bg-muted cursor-pointer rounded border px-2 py-1 text-xs italic"
                    title="Italic (_text_)"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelectionWith("~")}
                    className="border-border bg-background text-foreground hover:bg-muted cursor-pointer rounded border px-2 py-1 text-xs line-through"
                    title="Strikethrough (~text~)"
                  >
                    S
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelectionWith("```")}
                    className="border-border bg-background text-foreground hover:bg-muted cursor-pointer rounded border px-2 py-1 font-mono text-[11px]"
                    title="Monospace (```text```)"
                  >
                    &lt;/&gt;
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddVariableModal}
                  className="bg-cf-orange/10 text-cf-orange hover:bg-cf-orange/20 border-cf-orange/30 inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-semibold transition-colors"
                >
                  <Plus className="size-3.5" />
                  <span>
                    Add Variable &#123;&#123;
                    {bodyVariables.length + 1}&#125;&#125;
                  </span>
                </button>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <textarea
                  ref={bodyTextareaRef}
                  required
                  rows={6}
                  maxLength={1024}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder={`Dear {{1}},\n\nWe are pleased to inform you that your child {{2}} has been shortlisted for admission for session {{3}}.\n\nPlease visit the administrative office before {{4}} with the required certificates.`}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full resize-y rounded-md border p-3 font-sans text-xs leading-relaxed focus:ring-1 focus:outline-none"
                />
                <p className="text-muted-foreground text-[11px]">
                  Positional variables like{" "}
                  <code className="text-cf-orange font-bold">
                    &#123;&#123;1&#125;&#125;
                  </code>
                  ,{" "}
                  <code className="text-cf-orange font-bold">
                    &#123;&#123;2&#125;&#125;
                  </code>{" "}
                  can be mapped to CRM customer attributes (e.g.{" "}
                  <code className="text-purple-600 dark:text-purple-400">
                    customer.name
                  </code>
                  ) or static fixed text.
                </p>
              </div>

              {/* ========================================================= */}
              {/* CONFIGURED VARIABLES LIST */}
              {/* ========================================================= */}
              {bodyVariables.length > 0 && (
                <div className="border-border bg-muted/20 space-y-3 rounded-xl border p-4 text-xs">
                  <div className="border-border/60 flex items-center justify-between border-b pb-2.5">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="text-cf-orange size-4" />
                      <span className="text-foreground font-bold">
                        Variable Mappings &amp; Meta Samples (
                        {bodyVariables.length} Variables Detected)
                      </span>
                    </div>
                    <span className="text-muted-foreground text-[11px]">
                      Required for Meta review &amp; CRM resolution
                    </span>
                  </div>

                  <div className="space-y-3">
                    {bodyVariables.map((v) => {
                      const cfg = getEffectiveConfig(v);
                      const isDynamic = cfg.type === "dynamic";

                      return (
                        <div
                          key={v}
                          className="bg-card border-border/80 space-y-2.5 rounded-lg border p-3 shadow-2xs"
                        >
                          {/* Row 1: Badge, Switcher, and Config Button */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="bg-cf-orange rounded px-2 py-0.5 font-mono text-xs font-bold text-white shadow-2xs">
                                &#123;&#123;{v}&#125;&#125;
                              </span>
                              <span className="text-foreground font-semibold">
                                {isDynamic ? (
                                  <span className="font-mono text-[11px] text-purple-600 dark:text-purple-400">
                                    ⚡{" "}
                                    {cfg.field === "custom"
                                      ? cfg.customField || "custom_field"
                                      : cfg.field}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                    📌 Static: &quot;
                                    {cfg.staticValue || cfg.sample}&quot;
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Type toggle */}
                              <div className="border-border inline-flex rounded-md border p-0.5 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateVariableConfig(v, { type: "dynamic" })
                                  }
                                  className={`cursor-pointer rounded px-2 py-0.5 transition-colors ${
                                    isDynamic
                                      ? "bg-purple-600 font-semibold text-white"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  Dynamic
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateVariableConfig(v, { type: "static" })
                                  }
                                  className={`cursor-pointer rounded px-2 py-0.5 transition-colors ${
                                    !isDynamic
                                      ? "bg-amber-600 font-semibold text-white"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  Static
                                </button>
                              </div>

                              {/* Open Guided Modal Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditVariableModal(v)}
                                className="border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors"
                                title="Open full configuration dialog"
                              >
                                <Settings2 className="size-3" />
                                <span>Edit</span>
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Form Inputs */}
                          {isDynamic ? (
                            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                              {/* Field Selection */}
                              <div className="space-y-1">
                                <label className="text-muted-foreground text-[10px] font-semibold uppercase">
                                  CRM Field
                                </label>
                                <select
                                  value={cfg.field}
                                  onChange={(e) => {
                                    const opt = DYNAMIC_CRM_FIELDS.find(
                                      (f) => f.key === e.target.value
                                    );
                                    updateVariableConfig(v, {
                                      field: e.target.value,
                                      sample:
                                        cfg.sample ||
                                        opt?.defaultSample ||
                                        "Sample",
                                      fallback:
                                        cfg.fallback ||
                                        opt?.defaultFallback ||
                                        ""
                                    });
                                  }}
                                  className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
                                >
                                  {DYNAMIC_CRM_FIELDS.map((f) => (
                                    <option key={f.key} value={f.key}>
                                      {f.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* If Custom, Custom Field Name; Else Sample */}
                              {cfg.field === "custom" ? (
                                <div className="space-y-1">
                                  <label className="text-muted-foreground text-[10px] font-semibold uppercase">
                                    Attribute Path
                                  </label>
                                  <input
                                    type="text"
                                    value={cfg.customField}
                                    onChange={(e) =>
                                      updateVariableConfig(v, {
                                        customField: e.target.value
                                      })
                                    }
                                    placeholder="customer.student_name"
                                    className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-2 py-1 font-mono text-xs focus:ring-1 focus:outline-none"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <label className="text-muted-foreground text-[10px] font-semibold uppercase">
                                    Fallback Value
                                  </label>
                                  <input
                                    type="text"
                                    value={cfg.fallback}
                                    onChange={(e) =>
                                      updateVariableConfig(v, {
                                        fallback: e.target.value
                                      })
                                    }
                                    placeholder="e.g. Valued Parent"
                                    className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
                                  />
                                </div>
                              )}

                              {/* Meta Sample */}
                              <div className="space-y-1">
                                <label className="text-muted-foreground text-[10px] font-semibold uppercase">
                                  Meta Sample *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={cfg.sample}
                                  onChange={(e) =>
                                    updateVariableConfig(v, {
                                      sample: e.target.value
                                    })
                                  }
                                  placeholder="e.g. Rajesh Sharma"
                                  className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                              <div className="space-y-1 sm:col-span-2">
                                <label className="text-muted-foreground text-[10px] font-semibold uppercase">
                                  Static Fixed Value (sent to all contacts) *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={cfg.staticValue}
                                  onChange={(e) =>
                                    updateVariableConfig(v, {
                                      staticValue: e.target.value,
                                      sample: e.target.value
                                    })
                                  }
                                  placeholder="e.g. Greenfield Public School, Annual Meet 2026"
                                  className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Card 4: Footer (Optional) */}
            <div className="border-border bg-card space-y-3 rounded-xl border p-5 shadow-xs">
              <div className="border-border flex items-center justify-between border-b pb-2.5">
                <h2 className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                  <Info className="text-cf-orange size-4" />
                  <span>4. Footer Text (Optional)</span>
                </h2>
                <span className="text-muted-foreground font-mono text-[11px]">
                  {footerText.length} / 60
                </span>
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  maxLength={60}
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="e.g. Reply STOP to opt out • My School Branding"
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded-md border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
                />
                <p className="text-muted-foreground text-[11px]">
                  Short disclaimer or opt-out notice displayed in small muted
                  font at the bottom.
                </p>
              </div>
            </div>

            {/* Card 5: Buttons (Optional, Max 3) */}
            <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-xs">
              <div className="border-border flex items-center justify-between border-b pb-2.5">
                <h2 className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                  <ExternalLink className="text-cf-orange size-4" />
                  <span>5. Buttons (Optional • Max 3)</span>
                </h2>
                <span className="text-muted-foreground text-[11px]">
                  {buttons.length} / 3 added
                </span>
              </div>

              {/* Add Button Action Bar */}
              {buttons.length < 3 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddButton("QUICK_REPLY")}
                    className="border-border bg-background hover:bg-muted text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    <MessageSquare className="text-cf-orange size-3.5" />
                    <span>+ Quick Reply</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddButton("URL")}
                    className="border-border bg-background hover:bg-muted text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    <ExternalLink className="text-cf-orange size-3.5" />
                    <span>+ Website URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddButton("PHONE_NUMBER")}
                    className="border-border bg-background hover:bg-muted text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    <Phone className="text-cf-orange size-3.5" />
                    <span>+ Call Phone Number</span>
                  </button>
                </div>
              )}

              {/* Button List */}
              {buttons.length > 0 && (
                <div className="space-y-3">
                  {buttons.map((btn, index) => (
                    <div
                      key={btn.id}
                      className="border-border bg-muted/20 space-y-3 rounded-lg border p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="bg-cf-orange/10 text-cf-orange rounded px-1.5 py-0.5 text-[10px] font-bold">
                            #{index + 1}
                          </span>
                          <span className="text-foreground font-semibold">
                            {btn.type === "QUICK_REPLY"
                              ? "Quick Reply Button"
                              : btn.type === "URL"
                                ? "Website URL Button"
                                : "Phone Call Button"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveButton(btn.id)}
                          className="text-muted-foreground hover:text-destructive cursor-pointer p-1"
                          title="Remove button"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-muted-foreground text-[11px]">
                              Button Label (Max 25)
                            </label>
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {btn.text.length} / 25
                            </span>
                          </div>
                          <input
                            type="text"
                            maxLength={25}
                            required
                            value={btn.text}
                            onChange={(e) =>
                              handleUpdateButton(btn.id, {
                                text: e.target.value
                              })
                            }
                            placeholder="e.g. Confirm Admission"
                            className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-2.5 py-1 text-xs focus:ring-1 focus:outline-none"
                          />
                        </div>

                        {btn.type === "URL" && (
                          <div className="space-y-1">
                            <label className="text-muted-foreground text-[11px]">
                              Destination URL
                            </label>
                            <input
                              type="url"
                              required
                              value={btn.url || ""}
                              onChange={(e) =>
                                handleUpdateButton(btn.id, {
                                  url: e.target.value
                                })
                              }
                              placeholder="https://myschoolbranding.com"
                              className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-2.5 py-1 text-xs focus:ring-1 focus:outline-none"
                            />
                          </div>
                        )}

                        {btn.type === "PHONE_NUMBER" && (
                          <div className="space-y-1">
                            <label className="text-muted-foreground text-[11px]">
                              Phone Number (with country code)
                            </label>
                            <input
                              type="tel"
                              required
                              value={btn.phoneNumber || ""}
                              onChange={(e) =>
                                handleUpdateButton(btn.id, {
                                  phoneNumber: e.target.value
                                })
                              }
                              placeholder="+919876543210"
                              className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-2.5 py-1 text-xs focus:ring-1 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Submit Bar */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href="/templates"
                className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded-md border px-4 py-2 text-xs"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#e87516] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Submitting to Meta...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    <span>Submit Template for Meta Review</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: LIVE WHATSAPP PHONE PREVIEW */}
        {/* ========================================================= */}
        <div className="border-border bg-muted/20 hidden w-105 shrink-0 flex-col border-l p-6 lg:flex">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="text-cf-orange size-4" />
              <span className="text-foreground text-xs font-bold tracking-wider uppercase">
                Live WhatsApp Preview
              </span>
            </div>

            {/* 3-Way Mode Toggle */}
            <div className="border-border bg-muted/60 flex items-center rounded-lg border p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setPreviewMode("samples")}
                className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-colors ${
                  previewMode === "samples"
                    ? "bg-background text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Preview with sample data"
              >
                Sample Data
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("fields")}
                className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-colors ${
                  previewMode === "fields"
                    ? "bg-background text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Preview with CRM attribute tags"
              >
                CRM Fields
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("raw")}
                className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-colors ${
                  previewMode === "raw"
                    ? "bg-background text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Preview with raw {{1}} tags"
              >
                Meta Tags
              </button>
            </div>
          </div>

          {/* Smartphone Mockup Frame */}
          <div className="border-border bg-card relative flex flex-1 flex-col overflow-hidden rounded-3xl border shadow-xl">
            {/* Phone Top Notch / Speaker Bar */}
            <div className="bg-muted/60 flex h-6 items-center justify-center border-b">
              <div className="bg-muted-foreground/30 h-1 w-16 rounded-full" />
            </div>

            {/* WhatsApp App Header */}
            <div className="flex items-center justify-between bg-[#008069] px-3 py-2 text-white shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
                  MS
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1 text-xs leading-tight font-semibold">
                    <span>My School Branding</span>
                    <span className="rounded-full bg-white/20 p-0.5 text-[8px]">
                      ✓
                    </span>
                  </div>
                  <div className="text-[10px] leading-none text-white/80">
                    Official Business Account
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp Chat Body / Wallpaper */}
            <div className="flex-1 overflow-y-auto bg-[#efeae2] p-3 text-xs dark:bg-[#0b141a]">
              {/* Date Pill */}
              <div className="my-2 flex justify-center">
                <span className="bg-card/90 text-muted-foreground border-border/40 rounded-md border px-2 py-0.5 text-[10px] shadow-2xs">
                  TODAY
                </span>
              </div>

              {/* Message Bubble Card */}
              <div className="bg-card text-foreground border-border/50 max-w-[90%] space-y-2 rounded-lg rounded-tl-none border p-3 shadow-md">
                {/* Header Preview */}
                {headerType !== "NONE" && (
                  <div>
                    {headerType === "TEXT" && previewHeader && (
                      <h4 className="text-foreground text-xs font-bold">
                        {previewHeader}
                      </h4>
                    )}

                    {headerType === "IMAGE" && (
                      <div className="bg-muted/80 border-border/80 flex h-32 items-center justify-center rounded border">
                        <div className="text-muted-foreground flex flex-col items-center gap-1">
                          <ImageIcon className="text-cf-orange size-6" />
                          <span className="text-[10px]">
                            Image Header Banner
                          </span>
                        </div>
                      </div>
                    )}

                    {headerType === "VIDEO" && (
                      <div className="bg-muted/80 border-border/80 flex h-32 items-center justify-center rounded border">
                        <div className="text-muted-foreground flex flex-col items-center gap-1">
                          <Video className="text-cf-orange size-6" />
                          <span className="text-[10px]">
                            Video Header Media
                          </span>
                        </div>
                      </div>
                    )}

                    {headerType === "DOCUMENT" && (
                      <div className="bg-muted/80 border-border/80 flex items-center gap-2 rounded border p-2">
                        <FileText className="text-cf-orange size-5" />
                        <span className="text-foreground truncate font-mono text-[11px]">
                          Document_Attachment.pdf
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Body Preview */}
                <div className="text-foreground text-xs leading-relaxed whitespace-pre-wrap">
                  {previewBodyFormatted}
                </div>

                {/* Footer Preview */}
                {footerText.trim() && (
                  <p className="text-muted-foreground border-border/40 border-t pt-1 text-[10px] italic">
                    {footerText}
                  </p>
                )}

                {/* Timestamp and Checks */}
                <div className="text-muted-foreground flex items-center justify-end gap-1 pt-0.5 text-[9px]">
                  <span>10:45 AM</span>
                  <CheckCheck className="size-3 text-[#53bdeb]" />
                </div>
              </div>

              {/* Action Buttons Mockup below bubble */}
              {buttons.length > 0 && (
                <div className="mt-1.5 max-w-[90%] space-y-1">
                  {buttons.map((btn) => (
                    <div
                      key={btn.id}
                      className="bg-card border-border/60 hover:bg-card/80 flex items-center justify-center gap-1.5 rounded-md border py-2 text-center text-xs font-semibold text-[#00a884] shadow-xs"
                    >
                      {btn.type === "URL" ? (
                        <ExternalLink className="size-3" />
                      ) : btn.type === "PHONE_NUMBER" ? (
                        <Phone className="size-3" />
                      ) : (
                        <MessageSquare className="size-3" />
                      )}
                      <span>{btn.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Variables Summary Inside Preview */}
              {bodyVariables.length > 0 && (
                <div className="border-border/60 bg-card/70 mt-3 space-y-1.5 rounded-lg border p-2.5 text-[11px] shadow-2xs">
                  <div className="text-muted-foreground flex items-center justify-between text-[10px] font-bold tracking-wider uppercase">
                    <span>Active Variables ({bodyVariables.length})</span>
                    <span className="text-cf-orange font-mono">
                      {previewMode === "samples"
                        ? "Sample Mode"
                        : previewMode === "fields"
                          ? "CRM Field Mode"
                          : "Raw Tag Mode"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {bodyVariables.map((v) => {
                      const cfg = getEffectiveConfig(v);
                      return (
                        <div
                          key={v}
                          className="bg-background/80 border-border/40 flex items-center justify-between rounded border px-2 py-0.5 text-[10px]"
                        >
                          <span className="text-cf-orange font-mono font-bold">
                            &#123;&#123;{v}&#125;&#125;
                          </span>
                          <span className="text-muted-foreground max-w-42.5 truncate">
                            {cfg.type === "static"
                              ? `📌 "${cfg.staticValue || cfg.sample}"`
                              : `⚡ ${cfg.field === "custom" ? cfg.customField || "custom" : cfg.field}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Phone Home Bar */}
            <div className="bg-muted/40 flex h-5 items-center justify-center border-t">
              <div className="bg-muted-foreground/30 h-1 w-24 rounded-full" />
            </div>
          </div>

          {/* Meta Policy Reminder Footer */}
          <div className="border-border/60 text-muted-foreground bg-background/50 mt-4 space-y-1 rounded-lg border p-3 text-[11px]">
            <div className="text-foreground flex items-center gap-1 font-semibold">
              <Sparkles className="text-cf-orange size-3.5" />
              <span>Variable Resolution Notice</span>
            </div>
            <p>
              When sending messages, Dynamic variables automatically substitute
              each recipient&apos;s live contact details, while Static variables
              remain constant.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* GUIDED VARIABLE CONFIGURATION MODAL */}
      {/* ========================================================= */}
      {isConfigModalOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs duration-150">
          <div className="bg-card border-border animate-in zoom-in-95 w-full max-w-lg space-y-5 rounded-2xl border p-6 shadow-2xl duration-150">
            {/* Modal Header */}
            <div className="border-border flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="bg-cf-orange/10 text-cf-orange rounded-lg p-2">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h3 className="text-foreground text-sm font-bold">
                    Configure Variable &#123;&#123;{configModalTarget.index}
                    &#125;&#125;
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    Choose variable behavior and map to CRM customer attributes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-md p-1.5"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Step 1: Static or Dynamic (Requested Question) */}
            <div className="space-y-2">
              <label className="text-foreground text-xs font-bold tracking-wider uppercase">
                1. Is this variable Static or Dynamic? *
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Dynamic Card */}
                <button
                  type="button"
                  onClick={() =>
                    setModalForm((prev) => ({ ...prev, type: "dynamic" }))
                  }
                  className={`cursor-pointer space-y-1.5 rounded-xl border p-3.5 text-left transition-all ${
                    modalForm.type === "dynamic"
                      ? "border-cf-orange bg-cf-orange/5 ring-cf-orange shadow-xs ring-1"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-foreground text-xs font-semibold">
                        Dynamic Variable
                      </span>
                    </div>
                    {modalForm.type === "dynamic" && (
                      <span className="bg-cf-orange rounded-full p-0.5 text-white">
                        <Check className="size-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Personalized per recipient from CRM profile (e.g. name,
                    phone, custom attributes).
                  </p>
                </button>

                {/* Static Card */}
                <button
                  type="button"
                  onClick={() =>
                    setModalForm((prev) => ({ ...prev, type: "static" }))
                  }
                  className={`cursor-pointer space-y-1.5 rounded-xl border p-3.5 text-left transition-all ${
                    modalForm.type === "static"
                      ? "border-amber-500 bg-amber-500/5 shadow-xs ring-1 ring-amber-500"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pin className="size-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-foreground text-xs font-semibold">
                        Static Variable
                      </span>
                    </div>
                    {modalForm.type === "static" && (
                      <span className="rounded-full bg-amber-500 p-0.5 text-white">
                        <Check className="size-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Constant text sent identically to all recipients (e.g.
                    school name, offer title).
                  </p>
                </button>
              </div>
            </div>

            {/* Step 2: Form Fields depending on selection */}
            {modalForm.type === "dynamic" ? (
              <div className="space-y-3.5 pt-1 text-xs">
                {/* Field Selection */}
                <div className="space-y-1.5">
                  <label className="text-foreground font-semibold">
                    2. Select CRM Attribute *
                  </label>
                  <select
                    value={modalForm.field}
                    onChange={(e) => {
                      const opt = DYNAMIC_CRM_FIELDS.find(
                        (f) => f.key === e.target.value
                      );
                      setModalForm((prev) => ({
                        ...prev,
                        field: e.target.value,
                        sample: prev.sample || opt?.defaultSample || "Sample",
                        fallback: prev.fallback || opt?.defaultFallback || ""
                      }));
                    }}
                    className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
                  >
                    {DYNAMIC_CRM_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label} — {f.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* If Custom, User Defined Input */}
                {modalForm.field === "custom" && (
                  <div className="space-y-1.5">
                    <label className="text-foreground font-semibold">
                      User-Defined Attribute Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={modalForm.customField}
                      onChange={(e) =>
                        setModalForm((prev) => ({
                          ...prev,
                          customField: e.target.value
                        }))
                      }
                      placeholder="e.g. customer.student_name, customer.fee_due, customer.class"
                      className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded-lg border px-3 py-2 font-mono text-xs focus:ring-1 focus:outline-none"
                    />
                    <p className="text-muted-foreground text-[11px]">
                      Define any variable name. This field will be resolved for
                      each customer upon sending.
                    </p>
                  </div>
                )}

                {/* Sample Value for Meta (Required) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-foreground font-semibold">
                      3. Meta Sample Value (Required) *
                    </label>
                    <span className="text-muted-foreground text-[10px]">
                      For Meta template approval
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={modalForm.sample}
                    onChange={(e) =>
                      setModalForm((prev) => ({
                        ...prev,
                        sample: e.target.value
                      }))
                    }
                    placeholder="e.g. Rajesh Sharma"
                    className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
                  />
                  <p className="text-muted-foreground text-[11px]">
                    Meta requires realistic sample values for all variables to
                    approve templates.
                  </p>
                </div>

                {/* Fallback Value */}
                <div className="space-y-1.5">
                  <label className="text-foreground font-semibold">
                    4. Fallback Value (Optional)
                  </label>
                  <input
                    type="text"
                    value={modalForm.fallback}
                    onChange={(e) =>
                      setModalForm((prev) => ({
                        ...prev,
                        fallback: e.target.value
                      }))
                    }
                    placeholder="e.g. Valued Parent or Customer"
                    className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
                  />
                  <p className="text-muted-foreground text-[11px]">
                    Used if this contact does not have this attribute populated
                    in your CRM.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 pt-1 text-xs">
                {/* Static Fixed Value Input */}
                <div className="space-y-1.5">
                  <label className="text-foreground font-semibold">
                    2. Static Text Value *
                  </label>
                  <input
                    type="text"
                    required
                    value={modalForm.staticValue}
                    onChange={(e) =>
                      setModalForm((prev) => ({
                        ...prev,
                        staticValue: e.target.value,
                        sample: e.target.value
                      }))
                    }
                    placeholder="e.g. Greenfield Public School or 20% Discount"
                    className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
                  />
                  <p className="text-muted-foreground text-[11px]">
                    This exact text will be inserted for all recipients and
                    submitted to Meta as sample data.
                  </p>
                </div>
              </div>
            )}

            {/* Visual Mapping Summary */}
            <div className="border-border bg-muted/30 space-y-1 rounded-xl border p-3 text-xs">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Variable Summary
              </span>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-cf-orange font-bold">
                  &#123;&#123;{configModalTarget.index}&#125;&#125;
                </span>
                <span className="text-muted-foreground">➔</span>
                {modalForm.type === "dynamic" ? (
                  <span className="truncate font-semibold text-purple-600 dark:text-purple-400">
                    {modalForm.field === "custom"
                      ? modalForm.customField || "user_defined_attribute"
                      : modalForm.field}{" "}
                    (Sample: &quot;{modalForm.sample}&quot;
                    {modalForm.fallback
                      ? `, Fallback: "${modalForm.fallback}"`
                      : ""}
                    )
                  </span>
                ) : (
                  <span className="truncate font-semibold text-amber-600 dark:text-amber-400">
                    &quot;{modalForm.staticValue || "Fixed text"}&quot;
                    (Constant Value)
                  </span>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="border-border flex items-center justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded-lg border px-4 py-2 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVariableModal}
                className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#e87516]"
              >
                {configModalTarget.isNew
                  ? `Insert Variable {{${configModalTarget.index}}}`
                  : `Save Variable {{${configModalTarget.index}}}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
