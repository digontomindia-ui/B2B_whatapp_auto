"use client";

import { MessageSquare, Layers, Radio, FileSpreadsheet } from "lucide-react";
import { ToggleTheme } from "@/components/theme-toggle";
import { usePathname } from "next/navigation";
import Link from "next/link";

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Inbox",
      href: "/",
      icon: MessageSquare
    },
    {
      label: "Templates",
      href: "/templates",
      icon: Layers
    },
    {
      label: "Broadcast",
      href: "/broadcast",
      icon: Radio
    },
    {
      label: "Import & Export",
      href: "/import-export",
      icon: FileSpreadsheet
    }
  ];

  return (
    <aside className="border-border bg-card relative z-30 flex w-14 shrink-0 flex-col items-center justify-between border-r py-3 select-none">
      {/* Brand Icon Mark & Navigation */}
      <div className="flex w-full flex-col items-center">
        {/* Brand Mark */}
        <div className="group relative mb-4 flex w-full items-center justify-center">
          <Link
            href="/"
            className="bg-cf-orange flex size-8 items-center justify-center rounded font-mono text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-90"
            aria-label="My School Branding"
          >
            MS
          </Link>

          {/* Hover Popover */}
          <div className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-x-1 -translate-y-1/2 opacity-0 transition-all duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100">
            <div className="border-border bg-popover text-popover-foreground rounded border px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-md">
              My School Branding
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-border mb-3 w-7 border-t" />

        {/* Nav Items */}
        <nav className="flex w-full flex-col items-center gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <div
                key={item.href}
                className="group relative flex w-full items-center justify-center"
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="bg-cf-orange absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r" />
                )}

                <Link
                  href={item.href}
                  className={`flex size-9 items-center justify-center rounded transition-colors ${
                    isActive
                      ? "bg-accent text-cf-orange font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  aria-label={item.label}
                >
                  <Icon className="size-4" />
                </Link>

                {/* Hover Popover */}
                <div className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-x-1 -translate-y-1/2 opacity-0 transition-all duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100">
                  <div className="border-border bg-popover text-popover-foreground rounded border px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-md">
                    {item.label}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Empty bottom section to preserve layout structure */}
      <ToggleTheme />
    </aside>
  );
}
