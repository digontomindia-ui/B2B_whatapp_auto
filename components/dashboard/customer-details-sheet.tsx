"use client";

import React, { useState } from "react";
import { formatDisplayPhone } from "@/utils/phone";
import type { DashboardCustomer } from "./types";
import { CustomerState } from "@prisma/client";
import { toast } from "sonner";
import {
  X,
  User,
  Phone,
  MessageSquare,
  Shield,
  Tag as TagIcon,
  Save,
  Loader2,
  Calendar,
  Plus
} from "lucide-react";

interface CustomerDetailsSheetProps {
  customer: DashboardCustomer | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCustomer: (
    id: string,
    data: {
      customName?: string | null;
      profilePicUrl?: string | null;
      notes?: string | null;
      state?: CustomerState;
      tags?: string[];
    }
  ) => Promise<void>;
}

export function CustomerDetailsSheet({
  customer,
  isOpen,
  onClose,
  onUpdateCustomer
}: CustomerDetailsSheetProps) {
  const [customName, setCustomName] = useState(customer?.customName || "");
  const [profilePicUrl, setProfilePicUrl] = useState(customer?.profilePicUrl || "");
  const [notes, setNotes] = useState(customer?.notes || "");
  const [state, setState] = useState<CustomerState>(
    customer?.state || CustomerState.ACTIVE
  );
  const [tags, setTags] = useState<string[]>(
    customer?.tags?.map((t) => t.tag.name) || []
  );
  const [newTagInput, setNewTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [prevCustomerId, setPrevCustomerId] = useState<string | null>(customer?.id || null);

  // Sync state during render when customer changes
  if (customer && customer.id !== prevCustomerId) {
    setPrevCustomerId(customer.id);
    setCustomName(customer.customName || "");
    setProfilePicUrl(customer.profilePicUrl || "");
    setNotes(customer.notes || "");
    setState(customer.state);
    setTags(customer.tags?.map((t) => t.tag.name) || []);
  }

  if (!isOpen || !customer) return null;

  async function handleSave() {
    setIsSaving(true);
    try {
      await onUpdateCustomer(customer!.id, {
        customName: customName.trim() || null,
        profilePicUrl: profilePicUrl.trim() || null,
        notes: notes.trim() || null,
        state,
        tags
      });
      toast.success("Customer details updated");
    } catch {
      toast.error("Failed to update customer");
    } finally {
      setIsSaving(false);
    }
  }

  function handleAddTag() {
    const clean = newTagInput.trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setNewTagInput("");
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4 bg-muted/40">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <User className="size-4 text-cf-orange" />
          <span>Customer Profile</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Identity Overview with Profile Picture */}
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
          <div className="flex items-center gap-3 pb-2 border-b border-border/60">
            {profilePicUrl ? (
              <img
                src={profilePicUrl}
                alt={customer.customName || customer.whatsappName || "Profile"}
                className="h-12 w-12 rounded-full object-cover border border-border flex-shrink-0"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted font-bold text-sm text-foreground border border-border flex-shrink-0">
                {(customer.customName || customer.whatsappName || "WA").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <p className="font-semibold text-foreground text-sm truncate">
                {customer.customName || customer.whatsappName || formatDisplayPhone(customer.normalizedPhone)}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">
                {formatDisplayPhone(customer.normalizedPhone)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <MessageSquare className="size-3.5" />
            <span>WhatsApp Profile: </span>
            <span className="font-medium text-foreground">
              {customer.whatsappName || "Not reported"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="size-3.5" />
            <span>Added: </span>
            <span className="text-foreground">
              {new Date(customer.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Profile Picture URL field */}
        <div className="space-y-1.5">
          <label className="font-semibold text-foreground">
            Profile Picture URL
          </label>
          <p className="text-[11px] text-muted-foreground">
            Automatically captured from Meta when available, or customized here.
          </p>
          <input
            type="url"
            value={profilePicUrl}
            onChange={(e) => setProfilePicUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange"
          />
        </div>

        {/* Custom Name field */}
        <div className="space-y-1.5">
          <label className="font-semibold text-foreground">
            Custom Name (Admin-defined)
          </label>
          <p className="text-[11px] text-muted-foreground">
            App-specific name, never overwritten by WhatsApp profile updates.
          </p>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="e.g. Principal Sharma (DPS Delhi)"
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange"
          />
        </div>

        {/* Communication State */}
        <div className="space-y-1.5">
          <label className="font-semibold text-foreground flex items-center gap-1.5">
            <Shield className="size-3.5 text-cf-orange" />
            Communication State
          </label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as CustomerState)}
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange cursor-pointer"
          >
            <option value="ACTIVE">ACTIVE (Normal messaging)</option>
            <option value="BLOCKED">BLOCKED (Excluded from bulk)</option>
            <option value="OPTED_OUT">OPTED_OUT (Customer requested stop)</option>
          </select>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="font-semibold text-foreground flex items-center gap-1.5">
            <TagIcon className="size-3.5 text-cf-orange" />
            Tags
          </label>

          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground border border-border"
              >
                {t}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  className="text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Add tag (e.g. VIP, School_Delhi)..."
              className="flex-1 rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="inline-flex items-center gap-1 rounded border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
            >
              <Plus className="size-3" /> Add
            </button>
          </div>
        </div>

        {/* Administrative Notes */}
        <div className="space-y-1.5">
          <label className="font-semibold text-foreground">
            Administrative Notes
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes about this school or coordinator..."
            className="w-full resize-none rounded border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange"
          />
        </div>
      </div>

      {/* Footer Save */}
      <div className="border-t border-border bg-muted/40 p-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded bg-cf-orange px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516] transition-colors cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  );
}
