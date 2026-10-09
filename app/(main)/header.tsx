"use client";

import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth";
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
  }

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

      {/* Right Controls: User info with Role, Sign Out */}
      <div className="flex items-center gap-3">
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
