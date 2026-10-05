"use client";

import React from "react";
import { MessageSquare, Layers, Users, BarChart3, ShieldCheck } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-14 flex-col items-center justify-between border-r border-border bg-card py-3 flex-shrink-0 select-none">
      {/* Top brand icon */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cf-orange text-white shadow-xs font-bold text-sm tracking-tight" title="My School Branding CRM">
          MS
        </div>

        <nav className="flex flex-col items-center gap-2 pt-2">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-cf-orange transition-colors cursor-pointer"
            title="WhatsApp Communication Inbox"
          >
            <MessageSquare className="size-4.5" />
          </button>
        </nav>
      </div>

      {/* Bottom status badge */}
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-emerald-600 dark:text-emerald-400"
          title="Meta Cloud API Connected"
        >
          <ShieldCheck className="size-4.5" />
        </div>
      </div>
    </aside>
  );
}
