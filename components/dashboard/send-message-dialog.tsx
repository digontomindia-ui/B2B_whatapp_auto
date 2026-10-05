"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Send, Loader2, X, MessageSquare } from "lucide-react";
import type { DashboardCustomer } from "./types";
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
    activeCustomer?.id || (customers[0]?.id || "")
  );
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [prevActiveId, setPrevActiveId] = useState<string | null>(activeCustomer?.id || null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <MessageSquare className="size-4 text-cf-orange" />
            <span>Send Direct Message</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-3.5">
          <div>
            <label className="font-semibold text-foreground">Select Recipient</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange cursor-pointer"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customName || c.whatsappName || "Customer"} ({formatDisplayPhone(c.normalizedPhone)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-foreground">Message</label>
            <textarea
              rows={4}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your WhatsApp message..."
              className="mt-1 w-full resize-none rounded border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center gap-1.5 rounded bg-cf-orange px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e87516] cursor-pointer disabled:opacity-50"
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
