"use client";

import {
  FolderKanban,
  Plus,
  Search,
  Users,
  Radio,
  Edit2,
  Trash2,
  Loader2,
  ShieldAlert,
  ArrowRight,
  Clock
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useAuth } from "@/providers/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { toast } from "sonner";
import Link from "next/link";

interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  color: string;
  customerCount: number;
  broadcastCount: number;
  lastBroadcastAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const PRESET_COLORS = [
  "#f6821f", // Orange
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#64748b" // Slate
];

export default function GroupsPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isOwner } = useAuth();
  const canManage = isOwner || hasPermission(PERMISSIONS.GROUP_MANAGE);

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<GroupItem | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState("#f6821f");

  const { data: groups = [], isLoading } = useQuery<GroupItem[]>({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string;
      color: string;
    }) => {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group created successfully");
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to create group"
      );
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload
    }: {
      id: string;
      payload: { name: string; description?: string; color: string };
    }) => {
      const res = await fetch(`/api/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group updated successfully");
      setEditingGroup(null);
      resetForm();
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to update group"
      );
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group deleted successfully");
      setGroupToDelete(null);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete group"
      );
    }
  });

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormColor("#f6821f");
  }

  function openCreateModal() {
    resetForm();
    setIsCreateOpen(true);
  }

  function openEditModal(group: GroupItem) {
    setEditingGroup(group);
    setFormName(group.name);
    setFormDescription(group.description || "");
    setFormColor(group.color || "#f6821f");
  }

  function handleSaveForm(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      toast.error("Group name is required");
      return;
    }

    if (editingGroup) {
      updateMutation.mutate({
        id: editingGroup.id,
        payload: {
          name: cleanName,
          description: formDescription.trim() || undefined,
          color: formColor
        }
      });
    } else {
      createMutation.mutate({
        name: cleanName,
        description: formDescription.trim() || undefined,
        color: formColor
      });
    }
  }

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchName = g.name.toLowerCase().includes(q);
      const matchDesc = (g.description || "").toLowerCase().includes(q);
      return matchName || matchDesc;
    });
  }, [groups, search]);

  const totalCustomers = useMemo(
    () => groups.reduce((sum, g) => sum + (g.customerCount || 0), 0),
    [groups]
  );

  const totalBroadcasts = useMemo(
    () => groups.reduce((sum, g) => sum + (g.broadcastCount || 0), 0),
    [groups]
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Top Header */}
      <div className="border-border bg-card/60 sticky top-0 z-20 border-b px-6 py-4 backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-cf-orange/15 text-cf-orange rounded-lg p-2">
                <FolderKanban className="size-5" />
              </div>
              <div>
                <h1 className="text-foreground text-lg font-bold tracking-tight">
                  Customer Groups
                </h1>
                <p className="text-muted-foreground text-xs">
                  Organize contacts into schools, branches, or customer segments
                  for targeted broadcasts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <button
                onClick={openCreateModal}
                className="bg-cf-orange shadow-cf-orange/20 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <Plus className="size-3.5" />
                <span>Create Group</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="border-border bg-card rounded-xl border p-4.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Total Groups
              </span>
              <FolderKanban className="text-cf-orange size-4" />
            </div>
            <div className="text-foreground mt-2 font-mono text-3xl font-extrabold">
              {groups.length}
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Active contact segments
            </p>
          </div>

          <div className="border-border bg-card rounded-xl border p-4.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Grouped Contacts
              </span>
              <Users className="size-4 text-blue-500" />
            </div>
            <div className="text-foreground mt-2 font-mono text-3xl font-extrabold">
              {totalCustomers.toLocaleString()}
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Total assigned customer memberships
            </p>
          </div>

          <div className="border-border bg-card rounded-xl border p-4.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Group Broadcasts
              </span>
              <Radio className="size-4 text-emerald-500" />
            </div>
            <div className="text-foreground mt-2 font-mono text-3xl font-extrabold">
              {totalBroadcasts.toLocaleString()}
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Dispatched campaigns targeting groups
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search groups by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:ring-cf-orange w-full rounded-lg border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
            />
          </div>

          <div className="text-muted-foreground font-mono text-xs">
            Showing {filteredGroups.length} of {groups.length} groups
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-12 text-center">
            <Loader2 className="text-cf-orange size-8 animate-spin" />
            <p className="text-foreground mt-3 text-sm font-semibold">
              Loading Groups...
            </p>
          </div>
        )}

        {/* Groups Grid */}
        {!isLoading && filteredGroups.length === 0 && (
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-12 text-center">
            <div className="bg-cf-orange/10 text-cf-orange rounded-full p-3">
              <FolderKanban className="size-6" />
            </div>
            <h3 className="text-foreground mt-3 text-sm font-semibold">
              {search.trim()
                ? "No matching groups found"
                : "No groups created yet"}
            </h3>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">
              {search.trim()
                ? "Try searching with a different term."
                : "Create a group like 'DPS RK Puram' or 'Admissions 2026' to categorize customers for broadcasts."}
            </p>
            {canManage && !search.trim() && (
              <button
                onClick={openCreateModal}
                className="bg-cf-orange mt-4 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <Plus className="size-3.5" />
                <span>Create First Group</span>
              </button>
            )}
          </div>
        )}

        {!isLoading && filteredGroups.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className="border-border bg-card hover:border-cf-orange/40 group relative flex flex-col justify-between overflow-hidden rounded-xl border p-5 shadow-xs transition-all hover:shadow-md"
              >
                {/* Colored Top Accent Line */}
                <div
                  className="absolute top-0 right-0 left-0 h-1"
                  style={{ backgroundColor: group.color || "#f6821f" }}
                />

                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex size-9 items-center justify-center rounded-lg font-bold text-white shadow-xs"
                        style={{ backgroundColor: group.color || "#f6821f" }}
                      >
                        {group.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-foreground group-hover:text-cf-orange text-sm font-bold tracking-tight transition-colors">
                          {group.name}
                        </h3>
                        <p className="text-muted-foreground line-clamp-1 text-xs">
                          {group.description || "No description provided"}
                        </p>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={() => openEditModal(group)}
                          title="Edit Group"
                          className="hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer rounded p-1.5 transition-colors"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setGroupToDelete(group)}
                          title="Delete Group"
                          className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground cursor-pointer rounded p-1.5 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="border-border bg-muted/40 rounded-lg border p-2.5">
                      <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                        <Users className="size-3 text-blue-500" />
                        <span>Customers</span>
                      </div>
                      <div className="text-foreground mt-1 font-mono text-base font-bold">
                        {group.customerCount.toLocaleString()}
                      </div>
                    </div>

                    <div className="border-border bg-muted/40 rounded-lg border p-2.5">
                      <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                        <Radio className="size-3 text-emerald-500" />
                        <span>Broadcasts</span>
                      </div>
                      <div className="text-foreground mt-1 font-mono text-base font-bold">
                        {group.broadcastCount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-border mt-4 flex items-center justify-between border-t pt-3">
                  <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <Clock className="size-3" />
                    <span>
                      {group.lastBroadcastAt
                        ? `Last sent ${new Date(group.lastBroadcastAt).toLocaleDateString()}`
                        : `Created ${new Date(group.createdAt).toLocaleDateString()}`}
                    </span>
                  </div>

                  <Link
                    href={`/groups/${group.id}`}
                    className="text-cf-orange inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-90"
                  >
                    <span>Manage Details</span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE / EDIT GROUP MODAL */}
      {(isCreateOpen || editingGroup) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs select-none">
          <div className="border-border bg-card animate-in fade-in zoom-in-95 w-full max-w-md rounded-xl border p-6 shadow-2xl">
            <div className="border-border flex items-center justify-between border-b pb-3">
              <h2 className="text-foreground text-sm font-bold">
                {editingGroup ? "Edit Group" : "Create New Group"}
              </h2>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingGroup(null);
                  resetForm();
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-1 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-foreground text-xs font-semibold">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DPS RK Puram, Class 10 Parents, Leads"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:ring-cf-orange w-full rounded-md border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
                />
                <p className="text-muted-foreground text-[10px]">
                  Group names are unique and case-insensitive.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-xs font-semibold">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional brief description of this group..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:ring-cf-orange w-full rounded-md border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-xs font-semibold">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormColor(c)}
                      className={`size-6 cursor-pointer rounded-full transition-transform ${
                        formColor === c
                          ? "ring-cf-orange scale-110 ring-2 ring-offset-2"
                          : "opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="border-border flex items-center justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingGroup(null);
                    resetForm();
                  }}
                  className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="bg-cf-orange inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  <span>{editingGroup ? "Save Changes" : "Create Group"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs select-none">
          <div className="border-border bg-card animate-in fade-in zoom-in-95 w-full max-w-sm rounded-xl border p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="bg-destructive/15 text-destructive shrink-0 rounded-full p-2">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <h3 className="text-foreground text-sm font-bold">
                  Delete Group?
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  Are you sure you want to delete group &quot;
                  {groupToDelete.name}&quot;? Customers belonging to this group
                  will not be deleted; their group assignment will simply be
                  cleared.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(groupToDelete.id)}
                className="bg-destructive hover:bg-destructive/90 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="size-3 animate-spin" />
                )}
                <span>Delete Group</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
