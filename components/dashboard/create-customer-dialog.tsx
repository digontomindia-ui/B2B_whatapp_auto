"use client";

import {
  UserPlus,
  UserCheck,
  Loader2,
  X,
  Flame,
  Sun,
  Snowflake,
  Building2,
  Briefcase,
  MapPin,
  Lock
} from "lucide-react";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CustomerStatus } from "@prisma/client";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";
import type { DashboardGroup } from "./types";

interface CreateCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: {
    id: string;
    normalizedPhone: string;
  }) => void;
}

export function CreateCustomerDialog({
  isOpen,
  onClose,
  onCustomerCreated
}: CreateCustomerDialogProps) {
  const { isOwner, hasPermission } = useAuth();
  const canAssign = isOwner || hasPermission(PERMISSIONS.CUSTOMER_ASSIGN);

  const [phone, setPhone] = useState("");
  const [customName, setCustomName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("COLD");
  const [groupId, setGroupId] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { data: groupsData } = useQuery<{
    error: boolean;
    data: DashboardGroup[];
  }>({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups");
      return res.json();
    },
    enabled: isOpen
  });
  const groups = groupsData?.data || [];

  const { data: staffData } = useQuery<{
    error: boolean;
    data: Array<{
      id: string;
      name: string;
      email: string;
      isActive: boolean;
      role?: { name: string };
    }>;
  }>({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const res = await fetch("/api/staff");
      return res.json();
    },
    enabled: isOpen && canAssign
  });
  const staffMembers = (staffData?.data || []).filter((s) => s.isActive);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    setIsLoading(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          customName: customName.trim() || undefined,
          companyName: companyName.trim() || undefined,
          address: address.trim() || undefined,
          profilePicUrl: profilePicUrl.trim() || undefined,
          notes: notes.trim() || undefined,
          status,
          groupId: groupId.trim() || undefined,
          assignedStaffId:
            canAssign && assignedStaffId.trim()
              ? assignedStaffId.trim()
              : undefined,
          tags
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to create customer");
      }

      toast.success("Customer saved successfully");
      onCustomerCreated(json.data);
      onClose();
      setPhone("");
      setCustomName("");
      setCompanyName("");
      setAddress("");
      setProfilePicUrl("");
      setNotes("");
      setTagsInput("");
      setStatus("COLD");
      setGroupId("");
      setAssignedStaffId("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create customer";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 duration-150">
      <div className="border-border bg-card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b px-5 py-3.5">
          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="text-cf-orange size-4" />
            <span>Create / Find Customer</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded p-1 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Column 1: Core Contact Details */}
              <div className="space-y-3.5">
                <div>
                  <label className="text-foreground font-semibold">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 90461 13306"
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-3 py-1.5 font-mono text-xs focus:ring-1 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-foreground font-semibold">
                    Custom Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Principal Sharma"
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-foreground flex items-center gap-1.5 font-semibold">
                    <Briefcase className="text-cf-orange size-3.5" />
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Delhi Public School / Acme Corp"
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-foreground flex items-center gap-1.5 font-semibold">
                    <MapPin className="text-cf-orange size-3.5" />
                    Physical Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Sector 12, RK Puram, New Delhi"
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
              </div>

              {/* Column 2: Assignment, Group, Tags & Avatar */}
              <div className="space-y-3.5">
                <div>
                  <label className="text-foreground flex items-center gap-1.5 font-semibold">
                    <UserCheck className="text-cf-orange size-3.5" />
                    <span>Assign To Staff</span>
                    {!canAssign && (
                      <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px] font-normal">
                        <Lock className="size-2.5" />
                        Admin/Assigner only
                      </span>
                    )}
                  </label>
                  <select
                    disabled={!canAssign}
                    value={assignedStaffId}
                    onChange={(e) => setAssignedStaffId(e.target.value)}
                    className="border-border bg-background text-foreground focus:ring-cf-orange mt-1 w-full cursor-pointer rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">-- Unassigned --</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email}){s.role ? ` • ${s.role.name}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-foreground flex items-center gap-1.5 font-semibold">
                    <Building2 className="text-cf-orange size-3.5" />
                    Group / School
                  </label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="border-border bg-background text-foreground focus:ring-cf-orange mt-1 w-full cursor-pointer rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
                  >
                    <option value="">-- No Group (Unassigned) --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-foreground font-semibold">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="VIP, Delhi, Admissions"
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-foreground font-semibold">
                    Profile Picture URL (optional)
                  </label>
                  <input
                    type="url"
                    value={profilePicUrl}
                    onChange={(e) => setProfilePicUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
              </div>

              {/* Full Width Section across both columns (md:col-span-2) */}
              <div className="space-y-3.5 md:col-span-2">
                <div>
                  <label className="text-foreground flex items-center gap-1 font-semibold">
                    <Flame className="size-3.5 text-rose-500" />
                    Lead Status
                  </label>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus("HOT")}
                      className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border py-1.5 text-xs font-semibold transition-colors ${
                        status === "HOT"
                          ? "border-rose-500 bg-rose-500/15 font-bold text-rose-600 shadow-xs dark:text-rose-400"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Flame className="size-3 fill-rose-500 text-rose-500" />
                      Hot
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus("WARM")}
                      className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border py-1.5 text-xs font-semibold transition-colors ${
                        status === "WARM"
                          ? "border-amber-500 bg-amber-500/15 font-bold text-amber-600 shadow-xs dark:text-amber-400"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Sun className="size-3 text-amber-500" />
                      Warm
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus("COLD")}
                      className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border py-1.5 text-xs font-semibold transition-colors ${
                        status === "COLD"
                          ? "border-sky-500 bg-sky-500/15 font-bold text-sky-600 shadow-xs dark:text-sky-400"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Snowflake className="size-3 text-sky-500" />
                      Cold
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-foreground font-semibold">
                    Internal Notes
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Initial notes on this partner or prospect..."
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full resize-none rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer (Fixed at bottom) */}
          <div className="border-border bg-muted/30 flex shrink-0 justify-end gap-2 border-t px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded border px-3 py-1.5 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="size-3.5 animate-spin" />}
              <span>Save &amp; Open Chat</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
