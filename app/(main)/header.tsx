"use client";

import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/providers/auth";
import { useState } from "react";
import { toast } from "sonner";

export function Header() {
  const { admin, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  console.log({ admin });

  async function handleLogout() {
    try {
      setLoggingOut(true);
      toast.info("Signing out...");
      await logout();
    } catch {
      toast.error("Failed to sign out");
      setLoggingOut(false);
    }
  }
  return (
    <header className="border-border bg-card sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="text-foreground text-sm font-semibold tracking-tight">
          My School Branding
        </span>
        <span className="text-muted-foreground text-xs font-normal">CRM</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden flex-col text-right sm:flex">
          <span className="text-foreground text-xs leading-none font-medium">
            {admin?.name || "Admin"}
          </span>
          <span className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
            {admin?.email || "admin@school.com"}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={loggingOut}
          className="h-8 text-xs"
        >
          {loggingOut ? (
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
