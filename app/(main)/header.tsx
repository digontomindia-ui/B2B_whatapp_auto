"use client";

import { LogOut, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  let section = "Inbox";
  let sectionHref = "/";
  let subSection: string | null = null;
  if (pathname === "/templates/new") {
    section = "Templates";
    sectionHref = "/templates";
    subSection = "Create Template";
  } else if (pathname.startsWith("/templates")) {
    section = "Templates";
    sectionHref = "/templates";
  } else if (pathname === "/workflows/new") {
    section = "Workflows";
    sectionHref = "/workflows";
    subSection = "Create Workflow";
  } else if (pathname.startsWith("/workflows")) {
    section = "Workflows";
    sectionHref = "/workflows";
    if (pathname !== "/workflows") {
      subSection = "Edit Workflow";
    }
  } else if (pathname.startsWith("/broadcast")) {
    section = "Broadcast";
    sectionHref = "/broadcast";
  } else if (pathname.startsWith("/import-export")) {
    section = "Import & Export";
    sectionHref = "/import-export";
  } else if (pathname === "/staff/distribution") {
    section = "Staff & Roles";
    sectionHref = "/staff";
    subSection = "Customer Distribution";
  } else if (pathname.startsWith("/staff")) {
    section = "Staff & Roles";
    sectionHref = "/staff";
    if (pathname !== "/staff") {
      subSection = "Staff Details";
    }
  } else if (pathname.startsWith("/funds")) {
    section = "Funds & Billing";
    sectionHref = "/funds";
  }

  // Fetch live funds for the header pill
  const { data: fundsData } = useQuery<{
    error: boolean;
    data: {
      summary: {
        balance: number;
        currencySymbol: string;
        accountHealth: string;
      };
    };
  }>({
    queryKey: ["fundsData"],
    queryFn: async () => {
      const res = await fetch("/api/funds");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30000
  });

  const fundsSummary = fundsData?.data?.summary;

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      toast.info("Signing out...");
      await logout();
    } catch {
      toast.error("Failed to sign out");
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="border-border bg-card sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b px-4 select-none sm:px-6">
      {/* Cloudflare-style Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs sm:text-sm">
        <span className="text-foreground font-semibold tracking-tight">
          My School Branding
        </span>
        <span className="text-muted-foreground/50">/</span>
        {subSection ? (
          <>
            <Link
              href={sectionHref}
              className="text-muted-foreground hover:text-foreground font-normal transition-colors"
            >
              {section}
            </Link>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-foreground font-medium">{subSection}</span>
          </>
        ) : (
          <span className="text-muted-foreground font-normal">{section}</span>
        )}
      </div>

      {/* Right Controls: Funds Pill, User info with Role, Sign Out */}
      <div className="flex items-center gap-3">
        {/* Live Funds Balance Pill */}
        {fundsSummary && (
          <Link
            href="/funds"
            className="border-border bg-muted/50 hover:bg-muted text-foreground hover:border-cf-orange/40 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-2xs transition-colors"
            title="View WhatsApp Funds & Balance Details"
          >
            <Wallet className="size-3.5 text-cf-orange shrink-0" />
            <span className="font-mono text-xs font-semibold">
              {fundsSummary.currencySymbol}
              {fundsSummary.balance.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </Link>
        )}

        <div className="hidden flex-col text-right sm:flex">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-foreground text-xs leading-none font-medium">
              {user?.name || "User"}
            </span>
            <span className="bg-cf-orange/15 text-cf-orange rounded px-1.5 py-0.5 text-[10px] leading-none font-semibold">
              {user?.roleName || (user?.isOwner ? "Admin" : "Staff")}
            </span>
          </div>
          <span className="text-muted-foreground mt-1 font-mono text-[11px] leading-tight">
            {user?.email || ""}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="h-8 cursor-pointer gap-1.5 text-xs font-medium"
        >
          {isLoggingOut ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              <LogOut className="size-3.5" />
              <span>Sign Out</span>
            </>
          )}
        </Button>
      </div>
    </header>
  );
}
