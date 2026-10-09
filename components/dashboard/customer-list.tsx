"use client";

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
  Music,
  Loader2
} from "lucide-react";
import React from "react";
import { useInView } from "react-intersection-observer";
import { formatDisplayPhone } from "@/utils/phone";

interface CustomerListProps {
  customers: DashboardCustomer[];
  selectedCustomerId: string | null;
  onSelectCustomer: (customer: DashboardCustomer) => void;
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  totalCount?: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
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
  onClearSelection,
  totalCount,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage
}: CustomerListProps) {
  const isAllVisibleSelected =
    customers.length > 0 && customers.every((c) => selectedIds.has(c.id));

  const { ref: sentinelRef, inView } = useInView({
    threshold: 0,
    rootMargin: "200px"
  });

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && fetchNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="bg-card border-border flex h-full flex-col border-r">
      {/* Bulk selection helper header */}
      <div className="border-border bg-muted/40 flex items-center justify-between border-b px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={isAllVisibleSelected}
            onClick={() => {
              if (isAllVisibleSelected) {
                onClearSelection();
              } else {
                onSelectAllVisible();
              }
            }}
            className={`flex size-4 cursor-pointer items-center justify-center rounded border transition-colors ${
              isAllVisibleSelected
                ? "bg-cf-orange border-cf-orange text-white"
                : selectedIds.size > 0
                  ? "border-cf-orange bg-cf-orange/15 text-cf-orange"
                  : "border-border hover:border-foreground/50 bg-background"
            }`}
            title="Select all visible contacts"
          >
            {isAllVisibleSelected ? (
              <Check className="size-3 stroke-[3]" />
            ) : selectedIds.size > 0 ? (
              <span className="bg-cf-orange size-1.5 rounded-xs" />
            ) : null}
          </button>
          <span className="text-muted-foreground font-medium">
            {selectedIds.size > 0
              ? `${selectedIds.size} of ${customers.length} selected`
              : totalCount !== undefined && totalCount > customers.length
                ? `${customers.length} of ${totalCount} contacts`
                : `${customers.length} contact${customers.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={onClearSelection}
            className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium"
          >
            Deselect all
          </button>
        )}
      </div>

      {/* Customer items list */}
      <div className="divide-border/60 flex-1 divide-y overflow-y-auto">
        {isLoading && customers.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 p-8 text-center text-sm">
            <Loader2 className="text-cf-orange size-5 animate-spin" />
            <span>Loading conversations...</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center text-sm">
            <MessageSquare className="text-muted-foreground/40 mx-auto mb-2 size-8" />
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
                className={`group flex cursor-pointer items-start gap-3 p-3 transition-colors select-none ${
                  isSelected
                    ? "bg-accent/70 border-l-cf-orange border-l-4"
                    : "hover:bg-muted/50"
                }`}
              >
                {/* Selection checkbox */}
                <div
                  className="shrink-0 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(cust.id);
                    }}
                    className={`flex size-4 cursor-pointer items-center justify-center rounded border transition-colors ${
                      isChecked
                        ? "bg-cf-orange border-cf-orange text-white"
                        : "border-border hover:border-foreground/50 bg-background"
                    }`}
                  >
                    {isChecked && <Check className="size-3 stroke-[3]" />}
                  </button>
                </div>

                {/* Avatar with fallback initials */}
                <div className="relative flex-shrink-0">
                  {cust.profilePicUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={cust.profilePicUrl}
                      alt={displayName}
                      className="border-border h-11 w-11 rounded-full border object-cover"
                    />
                  ) : (
                    <div className="bg-muted text-foreground border-border flex h-11 w-11 items-center justify-center rounded-full border text-xs font-semibold">
                      {getInitials(cust.customName || cust.whatsappName)}
                    </div>
                  )}
                  {cust.state === "BLOCKED" && (
                    <span
                      className="absolute -right-0.5 -bottom-0.5 rounded-full bg-red-600 p-0.5 text-white"
                      title="Blocked"
                    >
                      <Ban className="size-3" />
                    </span>
                  )}
                  {cust.state === "OPTED_OUT" && (
                    <span
                      className="absolute -right-0.5 -bottom-0.5 rounded-full bg-amber-600 p-0.5 text-white"
                      title="Opted out"
                    >
                      <Slash className="size-3" />
                    </span>
                  )}
                </div>

                {/* Main info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-foreground truncate text-sm font-semibold">
                      {displayName}
                    </span>
                    <span className="text-muted-foreground text-[11px] whitespace-nowrap">
                      {relativeTime}
                    </span>
                  </div>

                  {/* Subtitle phone / WhatsApp profile */}
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <span className="font-mono text-[11px]">
                      {formatDisplayPhone(cust.normalizedPhone)}
                    </span>
                    {cust.customName && cust.whatsappName && (
                      <span className="text-muted-foreground/80 truncate text-[10px]">
                        • {cust.whatsappName}
                      </span>
                    )}
                  </div>

                  {/* Last message preview */}
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                      {lastMsg && (
                        <>
                          {lastMsg.direction === "OUTBOUND" && (
                            <span className="mr-0.5 inline-flex items-center">
                              {lastMsg.status === "QUEUED" ||
                              lastMsg.status === "SENDING" ? (
                                <Clock className="text-muted-foreground size-3" />
                              ) : lastMsg.status === "SENT" ? (
                                <Check className="text-muted-foreground size-3" />
                              ) : lastMsg.status === "DELIVERED" ? (
                                <CheckCheck className="text-muted-foreground size-3" />
                              ) : lastMsg.status === "READ" ? (
                                <CheckCheck className="size-3 text-emerald-500" />
                              ) : (
                                <AlertCircle className="text-destructive size-3" />
                              )}
                            </span>
                          )}

                          {lastMsg.type === "IMAGE" && (
                            <ImageIcon className="text-muted-foreground size-3" />
                          )}
                          {lastMsg.type === "VIDEO" && (
                            <Video className="text-muted-foreground size-3" />
                          )}
                          {lastMsg.type === "AUDIO" && (
                            <Music className="text-muted-foreground size-3" />
                          )}
                          {lastMsg.type === "DOCUMENT" && (
                            <FileText className="text-muted-foreground size-3" />
                          )}
                          {lastMsg.type === "TEMPLATE" && (
                            <span className="bg-muted text-foreground rounded px-1 text-[10px] font-medium">
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
                        <span className="text-muted-foreground/60 text-[11px] italic">
                          No messages yet
                        </span>
                      )}
                    </div>

                    {/* Unread badge */}
                    {cust.unreadCount > 0 && (
                      <span className="bg-cf-orange flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white shadow-xs">
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
                          className="bg-muted py-0.2 text-muted-foreground border-border/80 rounded-xs border px-1.5 text-[10px] font-medium"
                        >
                          {tag.name}
                        </span>
                      ))}
                      {cust.tags.length > 3 && (
                        <span className="text-muted-foreground text-[10px]">
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

        {/* Infinite scroll sentinel / loading indicator */}
        {hasNextPage && (
          <div
            ref={sentinelRef}
            className="border-border/40 text-muted-foreground flex items-center justify-center p-3 text-xs"
          >
            {isFetchingNextPage ? (
              <span className="flex items-center gap-2">
                <Loader2 className="text-cf-orange size-3.5 animate-spin" />
                <span>Loading more contacts...</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => fetchNextPage?.()}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-xs underline underline-offset-2"
              >
                Load more contacts
              </button>
            )}
          </div>
        )}

        {!hasNextPage &&
          customers.length > 0 &&
          totalCount !== undefined &&
          totalCount > 0 && (
            <div className="border-border/30 text-muted-foreground/60 border-t p-3 text-center text-[11px]">
              {customers.length >= totalCount
                ? `All ${totalCount} contacts loaded`
                : `Showing ${customers.length} of ${totalCount} contacts`}
            </div>
          )}
      </div>

      {/* Pagination summary footer */}
      {totalCount !== undefined && totalCount > 0 && (
        <div className="border-border bg-card/60 text-muted-foreground flex shrink-0 items-center justify-between border-t px-3 py-1.5 text-[11px]">
          <span>
            {customers.length < totalCount
              ? `Showing ${customers.length} of ${totalCount}`
              : `${totalCount} contacts total`}
          </span>
          <div className="flex items-center gap-2">
            {isFetchingNextPage ? (
              <span className="text-cf-orange flex items-center gap-1 font-medium">
                <Loader2 className="size-3 animate-spin" />
                <span>Loading...</span>
              </span>
            ) : hasNextPage ? (
              <button
                type="button"
                onClick={() => fetchNextPage?.()}
                className="hover:text-cf-orange cursor-pointer font-medium underline underline-offset-2 transition-colors"
              >
                Load more
              </button>
            ) : (
              <span className="text-muted-foreground/60">All loaded</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
