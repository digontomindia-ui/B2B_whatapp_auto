"use client";

import type { DashboardCustomer, DashboardMessage } from "./types";
import {
  Ban,
  User,
  Info,
  Slash,
  Check,
  Video,
  Music,
  Clock,
  Layers,
  Trash2,
  Loader2,
  FileText,
  RefreshCw,
  CheckCheck,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { formatDisplayPhone } from "@/utils/phone";
import { PERMISSIONS } from "@/lib/permissions";
import { useAuth } from "@/providers/auth";
import { toast } from "sonner";

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ConversationViewProps {
  customer: DashboardCustomer;
  messages: DashboardMessage[];
  isLoadingMessages: boolean;
  onOpenDetails: () => void;
  onOpenTemplateDialog: () => void;
  onCustomerDeleted?: () => void;
  onRefreshMessages?: () => Promise<void> | void;
  isRefreshingMessages?: boolean;
  children: React.ReactNode; // Composer component slot
}

function formatMessageTime(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return "Today";

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function ConversationView({
  customer,
  messages,
  isLoadingMessages,
  onOpenDetails,
  onOpenTemplateDialog,
  onCustomerDeleted,
  onRefreshMessages,
  isRefreshingMessages = false,
  children
}: ConversationViewProps) {
  const { hasPermission, hasAnyPermission, isOwner } = useAuth();
  const canSendTemplate =
    isOwner ||
    hasAnyPermission([
      PERMISSIONS.MESSAGE_SEND_UTILITY,
      PERMISSIONS.MESSAGE_SEND_MARKETING
    ]);
  const canDeleteCustomer =
    isOwner || hasPermission(PERMISSIONS.CUSTOMER_DELETE);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  async function handleDeleteCustomer() {
    if (!canDeleteCustomer) {
      toast.error("You do not have permission to delete contacts");
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to delete contact");
      }

      toast.success("Contact and all associated data deleted");
      setShowDeleteModal(false);
      onCustomerDeleted?.();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete contact";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const displayName =
    customer.customName ||
    customer.whatsappName ||
    formatDisplayPhone(customer.normalizedPhone);

  // Group messages by date
  const groupedMessages: Array<{ date: string; items: DashboardMessage[] }> =
    [];
  let currentDate = "";
  let currentGroup: DashboardMessage[] = [];

  for (const msg of messages) {
    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== currentDate) {
      if (currentGroup.length > 0) {
        groupedMessages.push({ date: currentDate, items: currentGroup });
      }
      currentDate = msgDate;
      currentGroup = [msg];
    } else {
      currentGroup.push(msg);
    }
  }
  if (currentGroup.length > 0) {
    groupedMessages.push({ date: currentDate, items: currentGroup });
  }

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Top Header of Chat */}
      <div className="border-border bg-card flex h-14 items-center justify-between border-b px-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            {customer.profilePicUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={customer.profilePicUrl}
                alt={displayName}
                className="border-border h-9 w-9 rounded-full border object-cover"
              />
            ) : (
              <div className="bg-muted border-border flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold">
                {customer.customName ? (
                  customer.customName.slice(0, 2).toUpperCase()
                ) : customer.whatsappName ? (
                  customer.whatsappName.slice(0, 2).toUpperCase()
                ) : (
                  <User className="text-muted-foreground size-4" />
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-foreground text-sm font-semibold">
                {displayName}
              </span>

              {customer.state === "BLOCKED" && (
                <span className="py-0.2 inline-flex items-center gap-1 rounded bg-red-100 px-1.5 text-[10px] font-semibold text-red-600 dark:bg-red-950/50 dark:text-red-400">
                  <Ban className="size-2.5" /> Blocked
                </span>
              )}
              {customer.state === "OPTED_OUT" && (
                <span className="py-0.2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                  <Slash className="size-2.5" /> Opted out
                </span>
              )}
            </div>

            <div className="text-muted-foreground font-mono text-[11px]">
              {formatDisplayPhone(customer.normalizedPhone)}
              {customer.whatsappName && customer.customName && (
                <span className="text-muted-foreground ml-1 font-sans">
                  • WA: {customer.whatsappName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {onRefreshMessages && (
            <button
              onClick={async () => {
                await onRefreshMessages();
              }}
              disabled={isRefreshingMessages || isLoadingMessages}
              className="border-border bg-background text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
              title="Sync & refresh messages"
            >
              <RefreshCw
                className={`text-cf-orange size-3.5 ${
                  isRefreshingMessages ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Sync Messages</span>
            </button>
          )}

          {canSendTemplate && (
            <button
              onClick={onOpenTemplateDialog}
              className="border-border bg-background text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
              title="Send Approved Template"
            >
              <Layers className="text-cf-orange size-3.5" />
              <span className="hidden sm:inline">Send Template</span>
            </button>
          )}

          {canDeleteCustomer && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="border-border bg-background text-destructive hover:bg-destructive/10 hover:border-destructive/30 inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
              title="Delete this contact and all related data"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Delete Contact</span>
            </button>
          )}

          <button
            onClick={onOpenDetails}
            className="border-border bg-background text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
            title="Customer Details & Notes"
          >
            <Info className="text-muted-foreground size-3.5" />
            <span className="hidden sm:inline">Details</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="bg-muted/20 flex-1 space-y-4 overflow-y-auto p-4">
        {isLoadingMessages && messages.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center p-6 text-center text-xs">
            <div className="bg-muted mb-2 rounded-full p-3">
              <User className="text-muted-foreground size-6" />
            </div>
            <p className="text-foreground font-semibold">
              No message history yet
            </p>
            <p className="text-muted-foreground mt-1 max-w-xs">
              Send a text or template below to initiate communication with this
              customer.
            </p>
          </div>
        ) : (
          groupedMessages.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-3">
              {/* Date Header Badge */}
              <div className="flex justify-center">
                <span className="bg-card text-muted-foreground border-border rounded-full border px-3 py-0.5 text-[10px] font-medium shadow-2xs">
                  {formatDateHeader(group.date)}
                </span>
              </div>

              {/* Messages in this date */}
              {group.items.map((msg) => {
                const isOutbound = msg.direction === "OUTBOUND";

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`relative max-w-[78%] rounded-lg px-3.5 py-2 text-xs shadow-2xs sm:max-w-[65%] ${
                        isOutbound
                          ? "border-cf-orange/30 text-foreground border bg-amber-500/10 dark:bg-amber-500/15"
                          : "bg-card border-border text-foreground border"
                      }`}
                    >
                      {/* Template label */}
                      {msg.type === "TEMPLATE" && (
                        <div className="text-cf-orange mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
                          <Layers className="size-3" />
                          <span>WhatsApp Template</span>
                        </div>
                      )}

                      {/* Media (Images, Videos, Audio, Documents) with Open in New Tab Button */}
                      {msg.mediaAttachment &&
                        (() => {
                          const mediaUrl =
                            msg.mediaAttachment.metaUrl ||
                            (msg.mediaAttachment.id
                              ? `/api/media/${msg.mediaAttachment.id}`
                              : null);

                          if (!mediaUrl) return null;

                          const isImage =
                            msg.mediaAttachment.type === "IMAGE" ||
                            msg.mediaAttachment.type === "STICKER";
                          const isVideo = msg.mediaAttachment.type === "VIDEO";
                          const isAudio = msg.mediaAttachment.type === "AUDIO";
                          const isDoc = msg.mediaAttachment.type === "DOCUMENT";

                          return (
                            <div className="mb-2 space-y-1.5">
                              {/* IMAGE / STICKER */}
                              {isImage && (
                                <div className="border-border/80 group relative overflow-hidden rounded-md border bg-black/5 dark:bg-black/20">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={mediaUrl}
                                    alt={
                                      msg.mediaAttachment.fileName ||
                                      "WhatsApp image"
                                    }
                                    className={`${
                                      msg.mediaAttachment.type === "STICKER"
                                        ? "max-h-36 max-w-36"
                                        : "max-h-72 w-auto max-w-full"
                                    } rounded object-contain`}
                                    loading="lazy"
                                  />
                                  <div className="bg-muted/40 border-border/50 mt-1 flex items-center justify-between border-t px-2 py-1 text-[11px]">
                                    <span className="text-muted-foreground max-w-[150px] truncate text-[10px]">
                                      {msg.mediaAttachment.fileName ||
                                        (msg.mediaAttachment.type === "STICKER"
                                          ? "Sticker"
                                          : "Photo")}
                                    </span>
                                    <a
                                      href={mediaUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-background/90 hover:bg-background text-foreground border-border inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium shadow-2xs transition-colors"
                                      title="Open image in new tab"
                                    >
                                      <ExternalLink className="text-cf-orange size-3" />
                                      <span>Open in new tab</span>
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* VIDEO */}
                              {isVideo && (
                                <div className="border-border/80 overflow-hidden rounded-md border bg-black/5 dark:bg-black/20">
                                  <video
                                    controls
                                    preload="metadata"
                                    className="max-h-72 w-full rounded bg-black/30 object-contain"
                                    src={mediaUrl}
                                  >
                                    Your browser does not support the video tag.
                                  </video>
                                  <div className="bg-muted/40 border-border/50 flex items-center justify-between border-t px-2.5 py-1.5 text-[11px]">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <Video className="text-cf-orange size-3.5 shrink-0" />
                                      <span className="text-foreground truncate text-[11px] font-medium">
                                        {msg.mediaAttachment.fileName ||
                                          "Video"}
                                      </span>
                                    </div>
                                    <a
                                      href={mediaUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-background/90 hover:bg-background text-foreground border-border ml-2 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium shadow-2xs transition-colors"
                                      title="Open video in new tab"
                                    >
                                      <ExternalLink className="text-cf-orange size-3" />
                                      <span>Open in new tab</span>
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* AUDIO */}
                              {isAudio && (
                                <div className="border-border/80 bg-muted/40 space-y-2 rounded-md border p-2.5">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <Music className="text-cf-orange size-3.5 shrink-0" />
                                      <span className="text-foreground truncate text-[11px] font-medium">
                                        {msg.mediaAttachment.fileName ||
                                          "Voice message"}
                                      </span>
                                    </div>
                                    <a
                                      href={mediaUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-background/90 hover:bg-background text-foreground border-border ml-2 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium shadow-2xs transition-colors"
                                      title="Open audio in new tab"
                                    >
                                      <ExternalLink className="text-cf-orange size-3" />
                                      <span>Open in new tab</span>
                                    </a>
                                  </div>
                                  <audio
                                    controls
                                    preload="metadata"
                                    className="h-8 w-full"
                                    src={mediaUrl}
                                  >
                                    Your browser does not support audio
                                    playback.
                                  </audio>
                                </div>
                              )}

                              {/* DOCUMENT */}
                              {isDoc && (
                                <div className="border-border/80 bg-muted/50 flex items-center justify-between gap-3 rounded-md border p-2.5">
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <div className="bg-cf-orange/15 border-cf-orange/30 flex size-9 shrink-0 items-center justify-center rounded-md border">
                                      <FileText className="text-cf-orange size-5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p
                                        className="text-foreground truncate text-xs font-semibold"
                                        title={
                                          msg.mediaAttachment.fileName ||
                                          "Document"
                                        }
                                      >
                                        {msg.mediaAttachment.fileName ||
                                          "Document"}
                                      </p>
                                      <p className="text-muted-foreground truncate text-[10px]">
                                        {formatFileSize(
                                          msg.mediaAttachment.fileSize
                                        ) ||
                                          msg.mediaAttachment.mimeType ||
                                          "Attachment"}
                                      </p>
                                    </div>
                                  </div>
                                  <a
                                    href={mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-background hover:bg-muted text-foreground border-border inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border px-2.5 py-1 text-[11px] font-medium shadow-2xs transition-colors"
                                    title="Open document in new tab"
                                  >
                                    <ExternalLink className="text-cf-orange size-3" />
                                    <span>Open in new tab</span>
                                  </a>
                                </div>
                              )}

                              {/* GENERIC / FALLBACK */}
                              {!isImage && !isVideo && !isAudio && !isDoc && (
                                <div className="border-border/80 bg-muted/40 flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                                  <span className="text-foreground truncate font-medium">
                                    {msg.mediaAttachment.fileName ||
                                      "Attachment"}
                                  </span>
                                  <a
                                    href={mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-background text-foreground border-border inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium"
                                    title="Open attachment in new tab"
                                  >
                                    <ExternalLink className="text-cf-orange size-3" />
                                    <span>Open in new tab</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      {/* Message Body */}
                      {msg.body && (
                        <p className="leading-relaxed break-words whitespace-pre-wrap">
                          {msg.body}
                        </p>
                      )}

                      {/* Interactive Buttons (Quick replies) if present */}
                      {(() => {
                        const payload = msg.rawPayload as Record<
                          string,
                          unknown
                        > | null;
                        const buttons =
                          (payload?.buttons as
                            Array<{ id: string; title: string }> | undefined) ||
                          [];
                        if (buttons.length > 0) {
                          return (
                            <div className="border-border/40 mt-2.5 flex flex-wrap gap-1.5 border-t pt-1.5">
                              {buttons.map((btn, bIdx) => (
                                <span
                                  key={btn.id || bIdx}
                                  className="border-border/80 bg-background/80 text-foreground inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium shadow-2xs"
                                >
                                  🔘 {btn.title}
                                </span>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Failure reason explanation if failed */}
                      {msg.status === "FAILED" && (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded border border-red-200 bg-red-100/80 p-1.5 text-[11px] text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                          <AlertCircle className="mt-0.5 size-3.5 flex-shrink-0" />
                          <div>
                            <span className="font-semibold">
                              Delivery failed:{" "}
                            </span>
                            {msg.errorMessage || "Rejected by Meta"}
                            {msg.errorCode && (
                              <span className="mt-0.5 block font-mono text-[10px] opacity-80">
                                Code: {msg.errorCode}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Message Footer: Timestamp and ticks */}
                      <div className="text-muted-foreground mt-1 flex items-center justify-end gap-1 text-[10px]">
                        <span>{formatMessageTime(msg.createdAt)}</span>

                        {isOutbound && (
                          <span className="ml-0.5 inline-flex items-center">
                            {msg.status === "QUEUED" ||
                            msg.status === "SENDING" ? (
                              <span title="Sending">
                                <Clock className="text-muted-foreground size-3" />
                              </span>
                            ) : msg.status === "SENT" ? (
                              <span title="Sent to Meta">
                                <Check className="text-muted-foreground size-3" />
                              </span>
                            ) : msg.status === "DELIVERED" ? (
                              <span title="Delivered to user">
                                <CheckCheck className="text-muted-foreground size-3" />
                              </span>
                            ) : msg.status === "READ" ? (
                              <span title="Read by user">
                                <CheckCheck className="size-3 text-emerald-500" />
                              </span>
                            ) : (
                              <span title="Failed">
                                <AlertCircle className="text-destructive size-3" />
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer Bottom Area */}
      <div className="border-border bg-card border-t p-3">{children}</div>

      {/* Delete Contact Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="border-border bg-card w-full max-w-sm space-y-3 rounded-lg border p-5 text-xs shadow-xl">
            <div className="text-destructive flex items-center gap-2 text-sm font-semibold">
              <Trash2 className="size-4" />
              <span>Delete Contact</span>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{displayName}</strong> (
              <span className="font-mono">
                {formatDisplayPhone(customer.normalizedPhone)}
              </span>
              )?
            </p>

            <div className="border-destructive/20 bg-destructive/5 text-destructive rounded border p-2.5 text-[11px] leading-normal">
              Warning: This will permanently delete this contact and all
              associated data including conversations, messages, media
              attachments, and notes. This action cannot be undone.
            </div>

            <div className="border-border flex justify-end gap-2 border-t pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded border px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90 inline-flex cursor-pointer items-center gap-1.5 rounded px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                <span>Delete Everything</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
