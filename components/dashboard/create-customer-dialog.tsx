"use client";

import { UserPlus, Loader2, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

interface CreateCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: {
    id: string;
    normalizedPhone: string;
  }) => void;
}

export function CreateCustomerDialog({
  isOpen,
  onClose,
  onCustomerCreated
}: CreateCustomerDialogProps) {
  const [phone, setPhone] = useState("");
  const [customName, setCustomName] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    setIsLoading(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          customName: customName.trim() || undefined,
          profilePicUrl: profilePicUrl.trim() || undefined,
          notes: notes.trim() || undefined,
          tags
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to create customer");
      }

      toast.success("Customer saved successfully");
      onCustomerCreated(json.data);
      onClose();
      setPhone("");
      setCustomName("");
      setNotes("");
      setTagsInput("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create customer";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 duration-150">
      <div className="border-border bg-card w-full max-w-md space-y-4 rounded-lg border p-5 shadow-2xl">
        <div className="border-border flex items-center justify-between border-b pb-3">
          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="text-cf-orange size-4" />
            <span>Create / Find Customer</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-foreground font-semibold">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <p className="text-muted-foreground text-[11px]">
              Supports 10 digits (India) or international formats (+91 90461
              13306).
            </p>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 90461 13306"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-3 py-1.5 font-mono text-xs focus:ring-1 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-foreground font-semibold">
              Custom Name / Organization
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Delhi Public School - Admin"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-foreground font-semibold">
              Profile Picture URL (optional)
            </label>
            <input
              type="url"
              value={profilePicUrl}
              onChange={(e) => setProfilePicUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-foreground font-semibold">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="VIP, Delhi, Admissions"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-foreground font-semibold">
              Internal Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Initial notes on this partner or prospect..."
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full resize-none rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
            />
          </div>

          <div className="border-border flex justify-end gap-2 border-t pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded border px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516] disabled:opacity-50"
            >
              {isLoading && <Loader2 className="size-3.5 animate-spin" />}
              <span>Save &amp; Open Chat</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
