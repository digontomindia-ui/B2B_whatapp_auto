"use client";

import { useAuth } from "@/providers/auth";
import {
  User,
  Mail,
  Users,
  Layers,
  Briefcase,
  Building2,
  ShieldCheck
} from "lucide-react";

export default function Homepage() {
  const { admin } = useAuth();

  return (
    <div className="bg-background text-foreground flex h-full flex-col">
      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {/* Page Header */}
        <div className="border-border flex flex-col gap-1 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground text-lg font-semibold tracking-tight">
              Dashboard Overview
            </h1>
            <p className="text-muted-foreground text-xs">
              School branding campaigns, customer leads, and administrative
              management
            </p>
          </div>
          <div className="border-border bg-card text-muted-foreground flex items-center gap-1.5 self-start rounded border px-2.5 py-1 text-xs sm:self-auto">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Session Active</span>
          </div>
        </div>

        {/* Quick Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-border bg-card rounded-md border p-4 shadow-xs">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Partner Schools</span>
              <Building2 className="size-4" />
            </div>
            <div className="text-foreground mt-2 font-mono text-2xl font-semibold tracking-tight">
              24
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Active branding clients
            </p>
          </div>

          <div className="border-border bg-card rounded-md border p-4 shadow-xs">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Inquiries &amp; Leads</span>
              <Users className="size-4" />
            </div>
            <div className="text-foreground mt-2 font-mono text-2xl font-semibold tracking-tight">
              142
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              This academic quarter
            </p>
          </div>

          <div className="border-border bg-card rounded-md border p-4 shadow-xs">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Active Campaigns</span>
              <Briefcase className="size-4" />
            </div>
            <div className="text-foreground mt-2 font-mono text-2xl font-semibold tracking-tight">
              18
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              In progress across regions
            </p>
          </div>

          <div className="border-border bg-card rounded-md border p-4 shadow-xs">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Branding Deliverables</span>
              <Layers className="size-4" />
            </div>
            <div className="text-foreground mt-2 font-mono text-2xl font-semibold tracking-tight">
              86
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Reviewed and published
            </p>
          </div>
        </div>

        {/* Administrator Profile & Session Details Card */}
        <div className="border-border bg-card rounded-md border shadow-xs">
          <div className="border-border flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-foreground text-sm font-semibold">
              Administrator Profile
            </h2>
            <span className="text-muted-foreground text-xs">
              Authenticated Admin
            </span>
          </div>

          <div className="divide-border divide-y text-xs">
            <div className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <User className="size-3.5" />
                Name
              </span>
              <span className="text-foreground font-medium sm:col-span-2">
                {admin?.name || "Admin"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <Mail className="size-3.5" />
                Email
              </span>
              <span className="text-foreground font-mono sm:col-span-2">
                {admin?.email || "admin@school.com"}
              </span>
            </div>

            <div className="grid grid-cols-1 items-center gap-1 px-5 py-3 sm:grid-cols-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="size-3.5" />
                Admin ID
              </span>
              <div className="flex items-center gap-2 sm:col-span-2">
                <code className="bg-muted text-foreground border-border rounded border px-2 py-0.5 font-mono text-[11px]">
                  {admin?.id || "N/A"}
                </code>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
    </div>
  );
}
