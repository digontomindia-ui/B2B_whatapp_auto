"use client";

import React from "react";
import { formatDisplayPhone } from "@/utils/phone";
import type { DashboardCustomer } from "./types";
import {
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  Ban,
  Slash,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  Video,
  Music
} from "lucide-react";

interface CustomerListProps {
  customers: DashboardCustomer[];
  selectedCustomerId: string | null;
  onSelectCustomer: (customer: DashboardCustomer) => void;
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
}

function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getInitials(name?: string | null): string {
  if (!name) return "WA";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function CustomerList({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  isLoading,
  selectedIds,
  onToggleSelect,
  onSelectAllVisible,
  onClearSelection
}: CustomerListProps) {
  const isAllVisibleSelected =
    customers.length > 0 && customers.every((c) => selectedIds.has(c.id));

  return (
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Bulk selection helper header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs bg-muted/40">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isAllVisibleSelected}
            onChange={() => {
              if (isAllVisibleSelected) {
                onClearSelection();
              } else {
                onSelectAllVisible();
              }
            }}
            className="h-3.5 w-3.5 rounded border-border accent-cf-orange cursor-pointer"
            title="Select all visible customers"
          />
          <span className="text-muted-foreground font-medium">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `${customers.length} contacts`}
          </span>
        </div>

        {selectedIds.size > 0 && (
          <button
            onClick={onClearSelection}
            className="text-xs text-muted-foreground hover:text-foreground font-medium cursor-pointer"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Customer items list */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60">
        {isLoading && customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading conversations...
          </div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 size-8 text-muted-foreground/40" />
            No customers match the current filter.
          </div>
        ) : (
          customers.map((cust) => {
            const isSelected = selectedCustomerId === cust.id;
            const isChecked = selectedIds.has(cust.id);
            const displayName =
              cust.customName ||
              cust.whatsappName ||
              formatDisplayPhone(cust.normalizedPhone);
            const lastMsg = cust.messages?.[0];
            const relativeTime = formatRelativeTime(
              cust.lastInteractionAt || cust.createdAt
            );

            return (
              <div
                key={cust.id}
                onClick={() => onSelectCustomer(cust)}
                className={`group flex items-start gap-3 p-3 transition-colors cursor-pointer select-none ${
                  isSelected
                    ? "bg-accent/70 border-l-4 border-l-cf-orange"
                    : "hover:bg-muted/50"
                }`}
              >
                {/* Selection checkbox */}
                <div
                  className="pt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(cust.id);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleSelect(cust.id)}
                    className="h-4 w-4 rounded border-border accent-cf-orange cursor-pointer"
                  />
                </div>

                {/* Avatar with fallback initials */}
                <div className="relative flex-shrink-0">
                  {cust.profilePicUrl ? (
                    <img
                      src={cust.profilePicUrl}
                      alt={displayName}
                      className="h-11 w-11 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted font-semibold text-xs text-foreground border border-border">
                      {getInitials(cust.customName || cust.whatsappName)}
                    </div>
                  )}
                  {cust.state === "BLOCKED" && (
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-red-600 p-0.5 text-white" title="Blocked">
                      <Ban className="size-3" />
                    </span>
                  )}
                  {cust.state === "OPTED_OUT" && (
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-amber-600 p-0.5 text-white" title="Opted out">
                      <Slash className="size-3" />
                    </span>
                  )}
                </div>

                {/* Main info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {displayName}
                    </span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {relativeTime}
                    </span>
                  </div>

                  {/* Subtitle phone / WhatsApp profile */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono text-[11px]">
                      {formatDisplayPhone(cust.normalizedPhone)}
                    </span>
                    {cust.customName && cust.whatsappName && (
                      <span className="truncate text-[10px] text-muted-foreground/80">
                        • {cust.whatsappName}
                      </span>
                    )}
                  </div>

                  {/* Last message preview */}
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      {lastMsg && (
                        <>
                          {lastMsg.direction === "OUTBOUND" && (
                            <span className="inline-flex items-center mr-0.5">
                              {lastMsg.status === "QUEUED" || lastMsg.status === "SENDING" ? (
                                <Clock className="size-3 text-muted-foreground" />
                              ) : lastMsg.status === "SENT" ? (
                                <Check className="size-3 text-muted-foreground" />
                              ) : lastMsg.status === "DELIVERED" ? (
                                <CheckCheck className="size-3 text-muted-foreground" />
                              ) : lastMsg.status === "READ" ? (
                                <CheckCheck className="size-3 text-emerald-500" />
                              ) : (
                                <AlertCircle className="size-3 text-destructive" />
                              )}
                            </span>
                          )}

                          {lastMsg.type === "IMAGE" && <ImageIcon className="size-3 text-muted-foreground" />}
                          {lastMsg.type === "VIDEO" && <Video className="size-3 text-muted-foreground" />}
                          {lastMsg.type === "AUDIO" && <Music className="size-3 text-muted-foreground" />}
                          {lastMsg.type === "DOCUMENT" && <FileText className="size-3 text-muted-foreground" />}
                          {lastMsg.type === "TEMPLATE" && (
                            <span className="rounded bg-muted px-1 text-[10px] font-medium text-foreground">
                              Template
                            </span>
                          )}

                          <span className="truncate text-xs">
                            {lastMsg.body ||
                              (lastMsg.type === "IMAGE"
                                ? "Photo"
                                : lastMsg.type === "VIDEO"
                                  ? "Video"
                                  : lastMsg.type === "AUDIO"
                                    ? "Voice message"
                                    : lastMsg.type === "DOCUMENT"
                                      ? "Document"
                                      : "Media message")}
                          </span>
                        </>
                      )}

                      {!lastMsg && (
                        <span className="italic text-muted-foreground/60 text-[11px]">
                          No messages yet
                        </span>
                      )}
                    </div>

                    {/* Unread badge */}
                    {cust.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cf-orange px-1.5 text-[10px] font-bold text-white shadow-xs">
                        {cust.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {cust.tags && cust.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {cust.tags.slice(0, 3).map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="rounded-xs bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground border border-border/80"
                        >
                          {tag.name}
                        </span>
                      ))}
                      {cust.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{cust.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
