"use client";

import type { DashboardCustomer } from "./types";
import { Send, Loader2, X, MessageSquare } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { formatDisplayPhone } from "@/utils/phone";

interface SendMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customers: DashboardCustomer[];
  activeCustomer: DashboardCustomer | null;
  onSent: () => void;
}

export function SendMessageDialog({
  isOpen,
  onClose,
  customers,
  activeCustomer,
  onSent
}: SendMessageDialogProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    activeCustomer?.id || customers[0]?.id || ""
  );
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [prevActiveId, setPrevActiveId] = useState<string | null>(
    activeCustomer?.id || null
  );
  if (activeCustomer && activeCustomer.id !== prevActiveId) {
    setPrevActiveId(activeCustomer.id);
    setSelectedCustomerId(activeCustomer.id);
  }

  if (!isOpen) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error("Please select a recipient");
      return;
    }
    if (!text.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          text: text.trim()
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to send message");
      }

      toast.success("Message dispatched");
      onSent();
      onClose();
      setText("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 duration-150">
      <div className="border-border bg-card w-full max-w-md space-y-4 rounded-lg border p-5 text-xs shadow-2xl">
        <div className="border-border flex items-center justify-between border-b pb-3">
          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="text-cf-orange size-4" />
            <span>Send Direct Message</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-3.5">
          <div>
            <label className="text-foreground font-semibold">
              Select Recipient
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-cf-orange mt-1 w-full cursor-pointer rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customName || c.whatsappName || "Customer"} (
                  {formatDisplayPhone(c.normalizedPhone)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-foreground font-semibold">Message</label>
            <textarea
              rows={4}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your WhatsApp message..."
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full resize-none rounded border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
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
              disabled={isSending}
              className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516] disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              <span>Send Message</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
