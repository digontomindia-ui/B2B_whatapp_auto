"use client";

import React, { useEffect, useRef } from "react";
import { formatDisplayPhone } from "@/utils/phone";
import type { DashboardCustomer, DashboardMessage } from "./types";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  User,
  Info,
  Layers,
  Ban,
  Slash,
  ExternalLink,
  Video,
  Music
} from "lucide-react";

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
  children
}: ConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const displayName =
    customer.customName ||
    customer.whatsappName ||
    formatDisplayPhone(customer.normalizedPhone);

  // Group messages by date
  const groupedMessages: Array<{ date: string; items: DashboardMessage[] }> = [];
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
    <div className="flex h-full flex-col bg-background">
      {/* Top Header of Chat */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            {customer.profilePicUrl ? (
              <img
                src={customer.profilePicUrl}
                alt={displayName}
                className="h-9 w-9 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted font-semibold text-xs border border-border">
                {customer.customName
                  ? customer.customName.slice(0, 2).toUpperCase()
                  : customer.whatsappName
                    ? customer.whatsappName.slice(0, 2).toUpperCase()
                    : <User className="size-4 text-muted-foreground" />}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {displayName}
              </span>

              {customer.state === "BLOCKED" && (
                <span className="inline-flex items-center gap-1 rounded bg-red-100 dark:bg-red-950/50 px-1.5 py-0.2 text-[10px] font-semibold text-red-600 dark:text-red-400">
                  <Ban className="size-2.5" /> Blocked
                </span>
              )}
              {customer.state === "OPTED_OUT" && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.2 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  <Slash className="size-2.5" /> Opted out
                </span>
              )}
            </div>

            <div className="text-[11px] text-muted-foreground font-mono">
              {formatDisplayPhone(customer.normalizedPhone)}
              {customer.whatsappName && customer.customName && (
                <span className="ml-1 text-muted-foreground font-sans">
                  • WA: {customer.whatsappName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTemplateDialog}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Send Approved Template"
          >
            <Layers className="size-3.5 text-cf-orange" />
            <span className="hidden sm:inline">Send Template</span>
          </button>

          <button
            onClick={onOpenDetails}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Customer Details & Notes"
          >
            <Info className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Details</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
        {isLoadingMessages && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground p-6">
            <div className="rounded-full bg-muted p-3 mb-2">
              <User className="size-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No message history yet</p>
            <p className="mt-1 max-w-xs text-muted-foreground">
              Send a text or template below to initiate communication with this customer.
            </p>
          </div>
        ) : (
          groupedMessages.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-3">
              {/* Date Header Badge */}
              <div className="flex justify-center">
                <span className="rounded-full bg-card px-3 py-0.5 text-[10px] font-medium text-muted-foreground border border-border shadow-2xs">
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
                      className={`max-w-[78%] sm:max-w-[65%] rounded-lg px-3.5 py-2 shadow-2xs text-xs relative ${
                        isOutbound
                          ? "bg-amber-500/10 dark:bg-amber-500/15 border border-cf-orange/30 text-foreground"
                          : "bg-card border border-border text-foreground"
                      }`}
                    >
                      {/* Template label */}
                      {msg.type === "TEMPLATE" && (
                        <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-cf-orange uppercase tracking-wider">
                          <Layers className="size-3" />
                          <span>WhatsApp Template</span>
                        </div>
                      )}

                      {/* Media (Images, Videos, Audio, Documents) with Open in New Tab Button */}
                      {msg.mediaAttachment && (() => {
                        const mediaUrl = msg.mediaAttachment.id
                          ? `/api/media/${msg.mediaAttachment.id}`
                          : msg.mediaAttachment.metaUrl;

                        if (!mediaUrl) return null;

                        const isImage = msg.mediaAttachment.type === "IMAGE" || msg.mediaAttachment.type === "STICKER";
                        const isVideo = msg.mediaAttachment.type === "VIDEO";
                        const isAudio = msg.mediaAttachment.type === "AUDIO";
                        const isDoc = msg.mediaAttachment.type === "DOCUMENT";

                        return (
                          <div className="mb-2 space-y-1.5">
                            {/* IMAGE / STICKER */}
                            {isImage && (
                              <div className="overflow-hidden rounded-md border border-border/80 bg-black/5 dark:bg-black/20 group relative">
                                <img
                                  src={mediaUrl}
                                  alt={msg.mediaAttachment.fileName || "WhatsApp image"}
                                  className={`${
                                    msg.mediaAttachment.type === "STICKER"
                                      ? "max-h-36 max-w-36"
                                      : "max-h-72 w-auto max-w-full"
                                  } rounded object-contain`}
                                  loading="lazy"
                                />
                                <div className="mt-1 flex items-center justify-between px-2 py-1 bg-muted/40 text-[11px] border-t border-border/50">
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                    {msg.mediaAttachment.fileName || (msg.mediaAttachment.type === "STICKER" ? "Sticker" : "Photo")}
                                  </span>
                                  <a
                                    href={mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded bg-background/90 hover:bg-background px-2 py-0.5 text-[10px] font-medium text-foreground border border-border shadow-2xs transition-colors cursor-pointer"
                                    title="Open image in new tab"
                                  >
                                    <ExternalLink className="size-3 text-cf-orange" />
                                    <span>Open in new tab</span>
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* VIDEO */}
                            {isVideo && (
                              <div className="overflow-hidden rounded-md border border-border/80 bg-black/5 dark:bg-black/20">
                                <video
                                  controls
                                  preload="metadata"
                                  className="max-h-72 w-full rounded object-contain bg-black/30"
                                  src={mediaUrl}
                                >
                                  Your browser does not support the video tag.
                                </video>
                                <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted/40 text-[11px] border-t border-border/50">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Video className="size-3.5 text-cf-orange shrink-0" />
                                    <span className="truncate text-foreground font-medium text-[11px]">
                                      {msg.mediaAttachment.fileName || "Video"}
                                    </span>
                                  </div>
                                  <a
                                    href={mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded bg-background/90 hover:bg-background px-2 py-0.5 text-[10px] font-medium text-foreground border border-border shadow-2xs transition-colors shrink-0 cursor-pointer ml-2"
                                    title="Open video in new tab"
                                  >
                                    <ExternalLink className="size-3 text-cf-orange" />
                                    <span>Open in new tab</span>
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* AUDIO */}
                            {isAudio && (
                              <div className="rounded-md border border-border/80 bg-muted/40 p-2.5 space-y-2">
                                <div className="flex items-center justify-between text-[11px]">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Music className="size-3.5 text-cf-orange shrink-0" />
                                    <span className="truncate font-medium text-foreground text-[11px]">
                                      {msg.mediaAttachment.fileName || "Voice message"}
                                    </span>
                                  </div>
                                  <a
                                    href={mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded bg-background/90 hover:bg-background px-2 py-0.5 text-[10px] font-medium text-foreground border border-border shadow-2xs transition-colors shrink-0 cursor-pointer ml-2"
                                    title="Open audio in new tab"
                                  >
                                    <ExternalLink className="size-3 text-cf-orange" />
                                    <span>Open in new tab</span>
                                  </a>
                                </div>
                                <audio controls preload="metadata" className="w-full h-8" src={mediaUrl}>
                                  Your browser does not support audio playback.
                                </audio>
                              </div>
                            )}

                            {/* DOCUMENT */}
                            {isDoc && (
                              <div className="rounded-md border border-border/80 bg-muted/50 p-2.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="size-9 rounded-md bg-cf-orange/15 border border-cf-orange/30 flex items-center justify-center shrink-0">
                                    <FileText className="size-5 text-cf-orange" />
                                  </div>
                                  <div className="min-w-0">
                                    <p
                                      className="font-semibold text-xs truncate text-foreground"
                                      title={msg.mediaAttachment.fileName || "Document"}
                                    >
                                      {msg.mediaAttachment.fileName || "Document"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {formatFileSize(msg.mediaAttachment.fileSize) ||
                                        msg.mediaAttachment.mimeType ||
                                        "Attachment"}
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={mediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded bg-background hover:bg-muted text-foreground px-2.5 py-1 text-[11px] font-medium border border-border shrink-0 shadow-2xs transition-colors cursor-pointer"
                                  title="Open document in new tab"
                                >
                                  <ExternalLink className="size-3 text-cf-orange" />
                                  <span>Open in new tab</span>
                                </a>
                              </div>
                            )}

                            {/* GENERIC / FALLBACK */}
                            {!isImage && !isVideo && !isAudio && !isDoc && (
                              <div className="rounded-md border border-border/80 bg-muted/40 p-2 flex items-center justify-between gap-2 text-xs">
                                <span className="truncate text-foreground font-medium">
                                  {msg.mediaAttachment.fileName || "Attachment"}
                                </span>
                                <a
                                  href={mediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-[10px] font-medium text-foreground border border-border shrink-0 cursor-pointer"
                                  title="Open attachment in new tab"
                                >
                                  <ExternalLink className="size-3 text-cf-orange" />
                                  <span>Open in new tab</span>
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Message Body */}
                      {msg.body && (
                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                          {msg.body}
                        </p>
                      )}

                      {/* Failure reason explanation if failed */}
                      {msg.status === "FAILED" && (
                        <div className="mt-1.5 rounded bg-red-100/80 dark:bg-red-950/40 p-1.5 text-[11px] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 flex items-start gap-1.5">
                          <AlertCircle className="size-3.5 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Delivery failed: </span>
                            {msg.errorMessage || "Rejected by Meta"}
                            {msg.errorCode && (
                              <span className="block font-mono text-[10px] opacity-80 mt-0.5">
                                Code: {msg.errorCode}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Message Footer: Timestamp and ticks */}
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                        <span>{formatMessageTime(msg.createdAt)}</span>

                        {isOutbound && (
                          <span className="inline-flex items-center ml-0.5">
                            {msg.status === "QUEUED" || msg.status === "SENDING" ? (
                              <span title="Sending"><Clock className="size-3 text-muted-foreground" /></span>
                            ) : msg.status === "SENT" ? (
                              <span title="Sent to Meta"><Check className="size-3 text-muted-foreground" /></span>
                            ) : msg.status === "DELIVERED" ? (
                              <span title="Delivered to user"><CheckCheck className="size-3 text-muted-foreground" /></span>
                            ) : msg.status === "READ" ? (
                              <span title="Read by user"><CheckCheck className="size-3 text-emerald-500" /></span>
                            ) : (
                              <span title="Failed"><AlertCircle className="size-3 text-destructive" /></span>
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
      <div className="border-t border-border bg-card p-3">
        {children}
      </div>
    </div>
  );
}
