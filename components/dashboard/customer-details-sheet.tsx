"use client";

import type { DashboardCustomer, DashboardGroup } from "./types";
import {
  X,
  User,
  UserCheck,
  MessageSquare,
  Shield,
  Tag as TagIcon,
  Save,
  Loader2,
  Calendar,
  Plus,
  Lock,
  Flame,
  Sun,
  Snowflake,
  Building2,
  Briefcase,
  MapPin
} from "lucide-react";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDisplayPhone } from "@/utils/phone";
import { CustomerState, CustomerStatus } from "@prisma/client";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";

interface CustomerDetailsSheetProps {
  customer: DashboardCustomer | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCustomer: (
    id: string,
    data: {
      customName?: string | null;
      companyName?: string | null;
      address?: string | null;
      profilePicUrl?: string | null;
      notes?: string | null;
      state?: CustomerState;
      status?: CustomerStatus;
      groupId?: string | null;
      assignedStaffId?: string | null;
      tags?: string[];
    }
  ) => Promise<void>;
}

export function CustomerDetailsSheet({
  customer,
  isOpen,
  onClose,
  onUpdateCustomer
}: CustomerDetailsSheetProps) {
  const { hasPermission, isOwner } = useAuth();
  const canEdit = isOwner || hasPermission(PERMISSIONS.CUSTOMER_EDIT);
  const canAssign = isOwner || hasPermission(PERMISSIONS.CUSTOMER_ASSIGN);
  const canManageGroup =
    isOwner ||
    hasPermission(PERMISSIONS.GROUP_MANAGE) ||
    hasPermission(PERMISSIONS.CUSTOMER_EDIT);

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
    enabled: isOpen && (canAssign || isOwner)
  });
  const staffMembers = (staffData?.data || []).filter((s) => s.isActive);

  const [customName, setCustomName] = useState(customer?.customName || "");
  const [companyName, setCompanyName] = useState(customer?.companyName || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [profilePicUrl, setProfilePicUrl] = useState(
    customer?.profilePicUrl || ""
  );
  const [notes, setNotes] = useState(customer?.notes || "");
  const [state, setState] = useState<CustomerState>(
    customer?.state || CustomerState.ACTIVE
  );
  const [status, setStatus] = useState<CustomerStatus>(
    customer?.status || CustomerStatus.COLD
  );
  const [groupId, setGroupId] = useState<string | null>(
    customer?.groupId || null
  );
  const [assignedStaffId, setAssignedStaffId] = useState<string | null>(
    customer?.assignedStaffId || null
  );
  const [tags, setTags] = useState<string[]>(
    customer?.tags?.map((t) => t.tag.name) || []
  );
  const [newTagInput, setNewTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [prevCustomerId, setPrevCustomerId] = useState<string | null>(
    customer?.id || null
  );

  // Sync state during render when customer changes
  if (customer && customer.id !== prevCustomerId) {
    setPrevCustomerId(customer.id);
    setCustomName(customer.customName || "");
    setCompanyName(customer.companyName || "");
    setAddress(customer.address || "");
    setProfilePicUrl(customer.profilePicUrl || "");
    setNotes(customer.notes || "");
    setState(customer.state);
    setStatus(customer.status || CustomerStatus.COLD);
    setGroupId(customer.groupId || null);
    setAssignedStaffId(customer.assignedStaffId || null);
    setTags(customer.tags?.map((t) => t.tag.name) || []);
  }

  if (!isOpen || !customer) return null;

  async function handleSave() {
    if (!canEdit && !canAssign && !canManageGroup) {
      toast.error("You do not have permission to edit customer details");
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateCustomer(customer!.id, {
        customName: customName.trim() || null,
        companyName: companyName.trim() || null,
        address: address.trim() || null,
        profilePicUrl: profilePicUrl.trim() || null,
        notes: notes.trim() || null,
        state,
        status,
        groupId: groupId || null,
        assignedStaffId: assignedStaffId || null,
        tags
      });
      toast.success("Customer details updated");
    } catch {
      toast.error("Failed to update customer");
    } finally {
      setIsSaving(false);
    }
  }

  function handleAddTag() {
    if (!canEdit) return;
    const clean = newTagInput.trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setNewTagInput("");
  }

  function handleRemoveTag(tagToRemove: string) {
    if (!canEdit) return;
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  return (
    <div className="bg-card border-border animate-in slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l shadow-2xl duration-200 sm:w-96">
      {/* Header */}
      <div className="border-border bg-muted/40 flex h-14 items-center justify-between border-b px-4">
        <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <User className="text-cf-orange size-4" />
          <span>Customer Profile</span>
          {!canEdit && (
            <span className="bg-muted text-muted-foreground border-border inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-normal">
              <Lock className="size-2.5" />
              Read-Only
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded p-1"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-xs">
        {/* Identity Overview with Profile Picture */}
        <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-3">
          <div className="border-border/60 flex items-center gap-3 border-b pb-2">
            {profilePicUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={profilePicUrl}
                alt={customer.customName || customer.whatsappName || "Profile"}
                className="border-border h-12 w-12 flex-shrink-0 rounded-full border object-cover"
              />
            ) : (
              <div className="bg-muted text-foreground border-border flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border text-sm font-bold">
                {(customer.customName || customer.whatsappName || "WA")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <p className="text-foreground truncate text-sm font-semibold">
                {customer.customName ||
                  customer.whatsappName ||
                  formatDisplayPhone(customer.normalizedPhone)}
              </p>
              <p className="text-muted-foreground font-mono text-[11px]">
                {formatDisplayPhone(customer.normalizedPhone)}
              </p>
            </div>
          </div>

          <div className="text-muted-foreground flex items-center gap-2">
            <MessageSquare className="size-3.5" />
            <span>WhatsApp Profile: </span>
            <span className="text-foreground font-medium">
              {customer.whatsappName || "Not reported"}
            </span>
          </div>

          <div className="text-muted-foreground flex items-center gap-2">
            <Calendar className="size-3.5" />
            <span>Added: </span>
            <span className="text-foreground">
              {new Date(customer.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Profile Picture URL field */}
        <div className="space-y-1.5">
          <label className="text-foreground font-semibold">
            Profile Picture URL
          </label>
          <p className="text-muted-foreground text-[11px]">
            Automatically captured from Meta when available, or customized here.
          </p>
          <input
            type="url"
            disabled={!canEdit}
            value={profilePicUrl}
            onChange={(e) => setProfilePicUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {/* Custom Name field */}
        <div className="space-y-1.5">
          <label className="text-foreground font-semibold">
            Custom Name (Admin-defined)
          </label>
          <p className="text-muted-foreground text-[11px]">
            App-specific name, never overwritten by WhatsApp profile updates.
          </p>
          <input
            type="text"
            disabled={!canEdit}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="e.g. Principal Sharma"
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {/* Company Name field */}
        <div className="space-y-1.5">
          <label className="text-foreground flex items-center gap-1.5 font-semibold">
            <Briefcase className="text-cf-orange size-3.5" />
            Company Name
          </label>
          <input
            type="text"
            disabled={!canEdit}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Delhi Public School / Acme Corp"
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {/* Physical Address field */}
        <div className="space-y-1.5">
          <label className="text-foreground flex items-center gap-1.5 font-semibold">
            <MapPin className="text-cf-orange size-3.5" />
            Physical Address
          </label>
          <textarea
            rows={2}
            disabled={!canEdit}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Sector 12, RK Puram, New Delhi 110022"
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full resize-none rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {/* Lead Status (Hot, Warm, Cold) */}
        <div className="space-y-1.5">
          <label className="text-foreground flex items-center gap-1.5 font-semibold">
            <Flame className="size-3.5 text-rose-500" />
            Lead Status
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setStatus("HOT")}
              className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border py-2 text-xs font-semibold transition-colors ${
                status === "HOT"
                  ? "border-rose-500 bg-rose-500/15 font-bold text-rose-600 shadow-xs dark:text-rose-400"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Flame className="size-3.5 fill-rose-500 text-rose-500" />
              Hot
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setStatus("WARM")}
              className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border py-2 text-xs font-semibold transition-colors ${
                status === "WARM"
                  ? "border-amber-500 bg-amber-500/15 font-bold text-amber-600 shadow-xs dark:text-amber-400"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Sun className="size-3.5 text-amber-500" />
              Warm
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setStatus("COLD")}
              className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border py-2 text-xs font-semibold transition-colors ${
                status === "COLD"
                  ? "border-sky-500 bg-sky-500/15 font-bold text-sky-600 shadow-xs dark:text-sky-400"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Snowflake className="size-3.5 text-sky-500" />
              Cold
            </button>
          </div>
        </div>

        {/* Communication State */}
        <div className="space-y-1.5">
          <label className="text-foreground flex items-center gap-1.5 font-semibold">
            <Shield className="text-cf-orange size-3.5" />
            Communication State
          </label>
          <select
            disabled={!canEdit}
            value={state}
            onChange={(e) => setState(e.target.value as CustomerState)}
            className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="ACTIVE">ACTIVE (Normal messaging)</option>
            <option value="BLOCKED">BLOCKED (Excluded from bulk)</option>
            <option value="OPTED_OUT">
              OPTED_OUT (Customer requested stop)
            </option>
          </select>
        </div>

        {/* Group (e.g. School Name) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-foreground flex items-center gap-1.5 font-semibold">
              <Building2 className="text-cf-orange size-3.5" />
              Group / School
            </label>
            {groupId && canManageGroup && (
              <button
                type="button"
                onClick={() => setGroupId(null)}
                className="text-muted-foreground cursor-pointer text-[11px] hover:text-red-500"
              >
                Clear Group
              </button>
            )}
          </div>
          <p className="text-muted-foreground text-[11px]">
            A customer belongs to one group. Used for group broadcasts (e.g.
            DPS).
          </p>
          <select
            disabled={!canManageGroup}
            value={groupId || ""}
            onChange={(e) => setGroupId(e.target.value || null)}
            className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">-- No Group Assigned --</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Assigned Staff (Assign / Reassign) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-foreground flex items-center gap-1.5 font-semibold">
              <UserCheck className="text-cf-orange size-3.5" />
              <span>Assigned Staff</span>
              {!canAssign && (
                <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px] font-normal">
                  <Lock className="size-2.5" />
                  Read-Only
                </span>
              )}
            </label>
            {assignedStaffId && canAssign && (
              <button
                type="button"
                onClick={() => setAssignedStaffId(null)}
                className="text-muted-foreground cursor-pointer text-[11px] hover:text-red-500"
              >
                Clear Assignment
              </button>
            )}
          </div>
          <p className="text-muted-foreground text-[11px]">
            Assign or reassign this customer to a staff member for follow-ups
            and management.
          </p>
          <select
            disabled={!canAssign}
            value={assignedStaffId || ""}
            onChange={(e) => setAssignedStaffId(e.target.value || null)}
            className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">-- Unassigned --</option>
            {staffMembers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email}){s.role ? ` • ${s.role.name}` : ""}
              </option>
            ))}
            {customer.assignedStaff &&
              !staffMembers.some(
                (s) => s.id === customer.assignedStaff?.id
              ) && (
                <option value={customer.assignedStaff.id}>
                  {customer.assignedStaff.name} ({customer.assignedStaff.email})
                </option>
              )}
          </select>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-foreground flex items-center gap-1.5 font-semibold">
            <TagIcon className="text-cf-orange size-3.5" />
            Tags
          </label>

          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="bg-muted text-foreground border-border inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium"
              >
                {t}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
            {tags.length === 0 && (
              <span className="text-muted-foreground text-[11px] italic">
                No tags assigned
              </span>
            )}
          </div>

          {canEdit && (
            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag (e.g. VIP, School_Delhi)..."
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange flex-1 rounded border px-2.5 py-1 text-xs focus:ring-1 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="border-border bg-background text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium"
              >
                <Plus className="size-3" /> Add
              </button>
            </div>
          )}
        </div>

        {/* Administrative Notes */}
        <div className="space-y-1.5">
          <label className="text-foreground font-semibold">
            Administrative Notes
          </label>
          <textarea
            rows={4}
            disabled={!canEdit}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes about this school or coordinator..."
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full resize-none rounded border px-3 py-2 text-xs focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      {/* Footer Save */}
      <div className="border-border bg-muted/40 flex justify-end gap-2 border-t p-3">
        <button
          onClick={onClose}
          className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded border px-3 py-1.5 text-xs"
        >
          {canEdit || canAssign || canManageGroup ? "Cancel" : "Close"}
        </button>
        {(canEdit || canAssign || canManageGroup) && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span>Save Changes</span>
          </button>
        )}
      </div>
    </div>
  );
}
