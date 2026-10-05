"use client";

import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth";
import { useState } from "react";
import { toast } from "sonner";

export function Header() {
  const pathname = usePathname();
  const { admin, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  let section = "Inbox";
  if (pathname.startsWith("/templates")) {
    section = "Templates";
  } else if (pathname.startsWith("/broadcast")) {
    section = "Broadcast";
  } else if (pathname.startsWith("/import-export")) {
    section = "Import & Export";
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
        <span className="text-muted-foreground font-normal">{section}</span>
      </div>

      {/* Right Controls: User info, Theme, Sign Out */}
      <div className="flex items-center gap-3">
        <div className="hidden flex-col text-right sm:flex">
          <span className="text-foreground text-xs leading-none font-medium">
            {admin?.name || "Admin"}
          </span>
          <span className="text-muted-foreground mt-0.5 font-mono text-[11px] leading-tight">
            {admin?.email || "admin@school.com"}
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
