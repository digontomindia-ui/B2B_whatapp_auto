"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSION_CATEGORIES,
  PERMISSIONS_PRESETS,
  ALL_PERMISSIONS
} from "@/lib/permissions";
import {
  Users,
  Shield,
  UserPlus,
  FileSpreadsheet,
  Plus,
  Search,
  Check,
  X,
  Trash2,
  Edit2,
  Download,
  AlertCircle,
  Loader2,
  Lock,
  UserCheck,
  UserX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Papa from "papaparse";

interface RoleItem {
  id: string;
  name: string;
  description: string | null;
  permissions: number[];
  isSystem: boolean;
  _count?: {
    staff: number;
  };
  createdAt: string;
}

interface StaffItem {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  roleId: string;
  role: {
    id: string;
    name: string;
    permissions: number[];
  };
  createdAt: string;
}

export default function StaffAndRolesPage() {
  const queryClient = useQueryClient();
  const { isOwner, hasPermission } = useAuth();

  const canViewStaff = isOwner || hasPermission(PERMISSIONS.STAFF_VIEW);
  const canViewRoles = isOwner || hasPermission(PERMISSIONS.ROLE_VIEW);
  const canManageStaff = isOwner || hasPermission(PERMISSIONS.STAFF_MANAGE);
  const canManageRoles = isOwner || hasPermission(PERMISSIONS.ROLE_MANAGE);

  const [activeTab, setActiveTab] = useState<"staff" | "roles">(() => {
    if (!canViewStaff && canViewRoles) return "roles";
    return "staff";
  });
  const [searchStaff, setSearchStaff] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");

  // Dialog states
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState(false);
  const [isImportStaffOpen, setIsImportStaffOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);

  // Queries
  const { data: roles = [], isLoading: isLoadingRoles } = useQuery<RoleItem[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/roles");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    enabled: canViewRoles
  });

  const { data: staffList = [], isLoading: isLoadingStaff } = useQuery<
    StaffItem[]
  >({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    enabled: canViewStaff
  });

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchesSearch =
        searchStaff === "" ||
        s.name.toLowerCase().includes(searchStaff.toLowerCase()) ||
        s.email.toLowerCase().includes(searchStaff.toLowerCase()) ||
        (s.phone && s.phone.includes(searchStaff));

      const matchesRole =
        selectedRoleFilter === "all" || s.roleId === selectedRoleFilter;

      return matchesSearch && matchesRole;
    });
  }, [staffList, searchStaff, selectedRoleFilter]);

  // Mutations
  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Staff member deleted successfully");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role deleted successfully");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const toggleStaffStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff status updated");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  if (!canViewStaff && !canViewRoles) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="bg-destructive/10 text-destructive mb-3 rounded-full p-3">
          <Lock className="size-6" />
        </div>
        <h2 className="text-foreground text-base font-semibold">
          Access Restricted
        </h2>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          You do not have permission to view staff accounts or roles. Contact
          your administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden">
      {/* Top Header Bar */}
      <div className="border-border bg-card shrink-0 border-b px-6 py-4 shadow-2xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-foreground text-lg font-bold tracking-tight">
              Staff & Access Management
            </h1>
            <p className="text-muted-foreground text-xs">
              Configure team roles, granular permissions, and manage staff
              accounts.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && (
              <>
                <Button
                  onClick={() => setIsImportStaffOpen(true)}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer gap-1.5 text-xs font-semibold"
                >
                  <FileSpreadsheet className="size-3.5 text-emerald-500" />
                  <span>Import Staff (CSV)</span>
                </Button>
                <Button
                  onClick={() => {
                    setEditingStaff(null);
                    setIsCreateStaffOpen(true);
                  }}
                  size="sm"
                  className="bg-cf-orange cursor-pointer gap-1.5 text-xs font-semibold text-white hover:bg-[#e87516]"
                >
                  <UserPlus className="size-3.5" />
                  <span>Add Staff Member</span>
                </Button>
              </>
            )}

            {(isOwner || hasPermission(PERMISSIONS.ROLE_MANAGE)) && (
              <Button
                onClick={() => {
                  setEditingRole(null);
                  setIsRoleModalOpen(true);
                }}
                variant="outline"
                size="sm"
                className="cursor-pointer gap-1.5 text-xs font-semibold"
              >
                <Plus className="text-cf-orange size-3.5" />
                <span>Create Role</span>
              </Button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="border-border mt-4 flex items-center gap-2 border-b text-xs">
          {canViewStaff && (
            <button
              onClick={() => setActiveTab("staff")}
              className={`cursor-pointer border-b-2 px-3 py-2 font-medium transition-colors ${
                activeTab === "staff"
                  ? "border-cf-orange text-cf-orange font-bold"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="size-4" />
                <span>Staff Members</span>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]">
                  {staffList.length}
                </span>
              </div>
            </button>
          )}

          {canViewRoles && (
            <button
              onClick={() => setActiveTab("roles")}
              className={`cursor-pointer border-b-2 px-3 py-2 font-medium transition-colors ${
                activeTab === "roles"
                  ? "border-cf-orange text-cf-orange font-bold"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="size-4" />
                <span>Roles & Permissions</span>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]">
                  {roles.length}
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ============================================================ */}
        {/* TAB 1: STAFF MEMBERS */}
        {/* ============================================================ */}
        {activeTab === "staff" && canViewStaff && (
          <div className="space-y-4">
            {/* Search and filter bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="relative max-w-xs min-w-44 flex-1">
                  <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchStaff}
                    onChange={(e) => setSearchStaff(e.target.value)}
                    placeholder="Search staff name, email, phone..."
                    className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-cf-orange w-full rounded-md border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
                  />
                </div>

                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  className="border-border bg-card text-foreground focus:ring-cf-orange cursor-pointer rounded-md border px-3 py-1.5 text-xs focus:ring-1 focus:outline-none"
                >
                  <option value="all">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-muted-foreground text-xs">
                Showing {filteredStaff.length} of {staffList.length} staff
              </div>
            </div>

            {/* Staff Table */}
            <div className="border-border bg-card overflow-hidden rounded-lg border shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-border text-muted-foreground border-b text-[11px] font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-3">Staff Member</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Joined</th>
                      {isOwner && (
                        <th className="px-4 py-3 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-border/60 divide-y">
                    {isLoadingStaff ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-muted-foreground p-8 text-center"
                        >
                          <Loader2 className="text-cf-orange mx-auto mb-2 size-6 animate-spin" />
                          <span>Loading staff members...</span>
                        </td>
                      </tr>
                    ) : filteredStaff.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-muted-foreground p-8 text-center"
                        >
                          <Users className="text-muted-foreground/40 mx-auto mb-2 size-8" />
                          <span>No staff members found matching criteria.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((staff) => (
                        <tr
                          key={staff.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="bg-muted text-foreground border-border flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold uppercase">
                                {staff.name.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-foreground font-semibold">
                                  {staff.name}
                                </div>
                                <div className="text-muted-foreground font-mono text-[11px]">
                                  {staff.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="text-muted-foreground px-4 py-3 font-mono">
                            {staff.phone || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-cf-orange/10 text-cf-orange border-cf-orange/30 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold">
                              {staff.role.name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {staff.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            ) : (
                              <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px] font-medium">
                                <span className="size-1.5 rounded-full bg-neutral-400" />
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="text-muted-foreground px-4 py-3 text-[11px]">
                            {new Date(staff.createdAt).toLocaleDateString()}
                          </td>
                          {isOwner && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    toggleStaffStatusMutation.mutate({
                                      id: staff.id,
                                      isActive: !staff.isActive
                                    });
                                  }}
                                  className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded p-1"
                                  title={
                                    staff.isActive ? "Deactivate" : "Activate"
                                  }
                                >
                                  {staff.isActive ? (
                                    <UserX className="size-4 text-amber-500" />
                                  ) : (
                                    <UserCheck className="size-4 text-emerald-500" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStaff(staff);
                                    setIsCreateStaffOpen(true);
                                  }}
                                  className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded p-1"
                                  title="Edit staff details"
                                >
                                  <Edit2 className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Are you sure you want to permanently delete staff member "${staff.name}"?`
                                      )
                                    ) {
                                      deleteStaffMutation.mutate(staff.id);
                                    }
                                  }}
                                  className="text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer rounded p-1"
                                  title="Delete staff"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: ROLES & PERMISSIONS */}
        {/* ============================================================ */}
        {activeTab === "roles" && canViewRoles && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoadingRoles ? (
                <div className="text-muted-foreground col-span-full p-12 text-center">
                  <Loader2 className="text-cf-orange mx-auto mb-2 size-6 animate-spin" />
                  <span>Loading roles and permissions...</span>
                </div>
              ) : (
                roles.map((role) => (
                  <div
                    key={role.id}
                    className="border-border bg-card flex flex-col justify-between rounded-lg border p-4 shadow-xs transition-shadow hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-foreground text-sm font-bold">
                            {role.name}
                          </h3>
                          {role.isSystem && (
                            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                              Default Preset
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {(isOwner ||
                            hasPermission(PERMISSIONS.ROLE_MANAGE)) && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRole(role);
                                setIsRoleModalOpen(true);
                              }}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded p-1"
                              title="Edit role permissions"
                            >
                              <Edit2 className="size-3.5" />
                            </button>
                          )}
                          {!role.isSystem &&
                            (isOwner ||
                              hasPermission(PERMISSIONS.ROLE_MANAGE)) && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Are you sure you want to delete role "${role.name}"?`
                                    )
                                  ) {
                                    deleteRoleMutation.mutate(role.id);
                                  }
                                }}
                                disabled={Boolean(
                                  role._count?.staff && role._count.staff > 0
                                )}
                                className={`rounded p-1 ${
                                  role._count?.staff && role._count.staff > 0
                                    ? "text-muted-foreground/30 cursor-not-allowed"
                                    : "text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer"
                                }`}
                                title={
                                  role._count?.staff && role._count.staff > 0
                                    ? "Cannot delete role assigned to staff"
                                    : "Delete role"
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                        </div>
                      </div>

                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {role.description || "No description provided."}
                      </p>

                      <div className="mt-3 flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                          <Users className="size-3.5" />
                          <span>{role._count?.staff || 0} staff assigned</span>
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                          <Lock className="size-3.5" />
                          <span>{role.permissions.length} permissions</span>
                        </span>
                      </div>
                    </div>

                    <div className="border-border mt-4 border-t pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingRole(role);
                          setIsRoleModalOpen(true);
                        }}
                        className="w-full cursor-pointer text-xs font-semibold"
                      >
                        <span>View / Configure Permissions</span>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: ADD / EDIT STAFF MEMBER */}
      {/* ============================================================ */}
      {isCreateStaffOpen && (
        <CreateOrEditStaffDialog
          isOpen={isCreateStaffOpen}
          onClose={() => {
            setIsCreateStaffOpen(false);
            setEditingStaff(null);
          }}
          staff={editingStaff}
          roles={roles}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["staff"] });
            queryClient.invalidateQueries({ queryKey: ["roles"] });
            setIsCreateStaffOpen(false);
            setEditingStaff(null);
          }}
        />
      )}

      {/* ============================================================ */}
      {/* MODAL 2: IMPORT STAFF VIA CSV (WITH ROLE MAPPING) */}
      {/* ============================================================ */}
      {isImportStaffOpen && (
        <ImportStaffDialog
          isOpen={isImportStaffOpen}
          onClose={() => setIsImportStaffOpen(false)}
          roles={roles}
          onImported={() => {
            queryClient.invalidateQueries({ queryKey: ["staff"] });
            queryClient.invalidateQueries({ queryKey: ["roles"] });
            setIsImportStaffOpen(false);
          }}
        />
      )}

      {/* ============================================================ */}
      {/* MODAL 3: CREATE / EDIT ROLE WITH PERMISSION PICKER */}
      {/* ============================================================ */}
      {isRoleModalOpen && (
        <RoleModal
          isOpen={isRoleModalOpen}
          onClose={() => {
            setIsRoleModalOpen(false);
            setEditingRole(null);
          }}
          role={editingRole}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
            setIsRoleModalOpen(false);
            setEditingRole(null);
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// MODAL: CREATE OR EDIT STAFF MEMBER
// -------------------------------------------------------------
function CreateOrEditStaffDialog({
  isOpen,
  onClose,
  staff,
  roles,
  onSaved
}: {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffItem | null;
  roles: RoleItem[];
  onSaved: () => void;
}) {
  const [name, setName] = useState(staff?.name || "");
  const [email, setEmail] = useState(staff?.email || "");
  const [phone, setPhone] = useState(staff?.phone || "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(staff?.roleId || roles[0]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Please enter staff member's name");
    if (!staff && !email.trim())
      return toast.error("Please enter email address");
    if (!staff && (!password || password.length < 6)) {
      return toast.error("Password must be at least 6 characters long");
    }
    if (!roleId) return toast.error("Please assign a role");

    try {
      setIsSubmitting(true);
      const url = staff ? `/api/staff/${staff.id}` : "/api/staff";
      const method = staff ? "PATCH" : "POST";

      const payload: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim() || null,
        roleId
      };

      if (!staff) {
        payload.email = email.trim();
        payload.password = password;
      } else if (password.trim()) {
        payload.password = password.trim();
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);

      toast.success(
        staff
          ? "Staff member updated successfully"
          : "Staff member created successfully"
      );
      onSaved();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save staff member"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="border-border bg-card w-full max-w-md rounded-lg border p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-foreground text-sm font-bold">
            {staff ? "Edit Staff Details" : "Add New Staff Member"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="text-foreground mb-1 block font-semibold">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-3 py-1.5 focus:ring-1 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block font-semibold">
              Email Address *
            </label>
            <input
              type="email"
              required
              disabled={!!staff}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rahul@school.com"
              className={`border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-3 py-1.5 focus:ring-1 focus:outline-none ${
                staff ? "cursor-not-allowed opacity-60" : ""
              }`}
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block font-semibold">
              Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-3 py-1.5 focus:ring-1 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block font-semibold">
              Assign Role *
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded border px-3 py-1.5 focus:ring-1 focus:outline-none"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.permissions.length} perms)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-foreground mb-1 block font-semibold">
              {staff ? "Change Password (optional)" : "Password *"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                staff
                  ? "Leave blank to keep current password"
                  : "At least 6 characters"
              }
              className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-3 py-1.5 focus:ring-1 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-cf-orange cursor-pointer text-white hover:bg-[#e87516]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Saving...
                </>
              ) : staff ? (
                "Update Staff"
              ) : (
                "Create Staff"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MODAL: IMPORT STAFF FROM CSV WITH ROLE NAME MAPPING
// -------------------------------------------------------------
function ImportStaffDialog({
  isOpen,
  onClose,
  roles,
  onImported
}: {
  isOpen: boolean;
  onClose: () => void;
  roles: RoleItem[];
  onImported: () => void;
}) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [defaultRoleName, setDefaultRoleName] = useState(
    roles[0]?.name || "Support Agent"
  );
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const roleNameSet = new Set(roles.map((r) => r.name.toLowerCase()));

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a valid CSV file");
      return;
    }

    setCsvFile(file);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        setParsedRows(results.data);
      },
      error: (err) => {
        toast.error("Failed to parse CSV: " + err.message);
      }
    });
  }

  function downloadSampleCsv() {
    const sample = [
      {
        name: "Aman Verma",
        email: "aman@school.com",
        phone: "+91 98765 11111",
        password: "StaffPassword123",
        role: "Support Agent"
      },
      {
        name: "Sneha Roy",
        email: "sneha@school.com",
        phone: "+91 98765 22222",
        password: "StaffPassword123",
        role: "Marketing Agent"
      },
      {
        name: "Vikram Mehta",
        email: "vikram@school.com",
        phone: "+91 98765 33333",
        password: "StaffPassword123",
        role: "Manager"
      }
    ];

    const csvContent = Papa.unparse(sample, { header: true });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample_staff_import.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Sample staff CSV template downloaded");
  }

  async function handleImport() {
    if (parsedRows.length === 0) {
      return toast.error("No staff rows found in uploaded CSV");
    }

    try {
      setIsImporting(true);
      const res = await fetch("/api/staff/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: parsedRows,
          options: {
            updateExisting: true,
            defaultRoleName
          }
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);

      toast.success(json.message);
      onImported();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to import staff"
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="border-border bg-card w-full max-w-2xl rounded-lg border p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-foreground text-sm font-bold">
              Import Staff from CSV
            </h2>
            <p className="text-muted-foreground text-xs">
              Upload a CSV file with staff accounts and automatic role name
              mapping.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {/* Download sample template */}
          <div className="border-border bg-muted/30 flex items-center justify-between rounded border p-3">
            <div>
              <div className="text-foreground font-semibold">
                Download Sample CSV Template
              </div>
              <div className="text-muted-foreground text-[11px]">
                Includes columns: name, email, phone, password, role
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSampleCsv}
              className="cursor-pointer gap-1.5 text-xs"
            >
              <Download className="text-cf-orange size-3.5" />
              <span>Sample CSV</span>
            </Button>
          </div>

          {/* File input */}
          <div>
            <label className="text-foreground mb-1 block font-semibold">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="border-border bg-background text-foreground file:bg-cf-orange w-full rounded border p-2 file:cursor-pointer file:rounded file:border-0 file:px-2.5 file:py-1 file:text-xs file:text-white"
            />
            {csvFile && (
              <p className="text-muted-foreground mt-1 text-[11px]">
                Selected file:{" "}
                <strong className="text-foreground">{csvFile.name}</strong> (
                {(csvFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Default fallback role */}
          <div>
            <label className="text-foreground mb-1 block font-semibold">
              Fallback Role (for rows missing role column)
            </label>
            <select
              value={defaultRoleName}
              onChange={(e) => setDefaultRoleName(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-cf-orange w-full cursor-pointer rounded border px-3 py-1.5 focus:ring-1 focus:outline-none"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Preview table */}
          {parsedRows.length > 0 && (
            <div>
              <div className="text-foreground mb-1 flex items-center justify-between font-semibold">
                <span>Preview Detected Rows ({parsedRows.length})</span>
                <span className="text-muted-foreground text-[11px]">
                  Roles will be verified and mapped automatically
                </span>
              </div>
              <div className="border-border max-h-48 overflow-y-auto rounded border">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-muted text-muted-foreground sticky top-0 uppercase">
                    <tr>
                      <th className="px-2.5 py-1.5">Row</th>
                      <th className="px-2.5 py-1.5">Name</th>
                      <th className="px-2.5 py-1.5">Email</th>
                      <th className="px-2.5 py-1.5">Role in CSV</th>
                      <th className="px-2.5 py-1.5">Mapping Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {parsedRows.slice(0, 15).map((row, idx) => {
                      const rowRole =
                        row.role || row.rolename || row.designation || "";
                      const isMatched =
                        rowRole && roleNameSet.has(rowRole.toLowerCase());

                      return (
                        <tr key={idx}>
                          <td className="text-muted-foreground px-2.5 py-1">
                            #{idx + 1}
                          </td>
                          <td className="text-foreground px-2.5 py-1 font-medium">
                            {row.name || "—"}
                          </td>
                          <td className="text-muted-foreground px-2.5 py-1 font-mono">
                            {row.email || "—"}
                          </td>
                          <td className="text-foreground px-2.5 py-1 font-semibold">
                            {rowRole || (
                              <span className="text-muted-foreground italic">
                                Uses fallback ({defaultRoleName})
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-1">
                            {isMatched ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-500">
                                <Check className="size-3" />
                                Mapped to &quot;{rowRole}&quot;
                              </span>
                            ) : rowRole ? (
                              <span className="text-destructive inline-flex items-center gap-1 font-semibold">
                                <AlertCircle className="size-3" />
                                Role &quot;{rowRole}&quot; not found
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                                Default to &quot;{defaultRoleName}&quot;
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isImporting || parsedRows.length === 0}
              onClick={handleImport}
              className="bg-cf-orange cursor-pointer text-white hover:bg-[#e87516]"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${parsedRows.length} Staff Members`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MODAL: CREATE OR EDIT ROLE WITH PERMISSION CATEGORIES
// -------------------------------------------------------------
function RoleModal({
  isOpen,
  onClose,
  role,
  onSaved
}: {
  isOpen: boolean;
  onClose: () => void;
  role: RoleItem | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role?.name || "");
  const [description, setDescription] = useState(role?.description || "");
  const [selectedPerms, setSelectedPerms] = useState<Set<number>>(
    new Set(role?.permissions || [])
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  function togglePermission(perm: number) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }

  function applyPreset(preset: (typeof PERMISSIONS_PRESETS)[0]) {
    if (preset.perms === "all") {
      setSelectedPerms(new Set(ALL_PERMISSIONS));
    } else if (preset.perms === "none") {
      setSelectedPerms(new Set());
    } else {
      setSelectedPerms(new Set(preset.perms as number[]));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Role name is required");

    try {
      setIsSubmitting(true);
      const url = role ? `/api/roles/${role.id}` : "/api/roles";
      const method = role ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          permissions: Array.from(selectedPerms)
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message);

      toast.success(
        role ? "Role updated successfully" : "Role created successfully"
      );
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="border-border bg-card flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-foreground text-sm font-bold">
              {role ? `Configure Role: ${role.name}` : "Create New Role"}
            </h2>
            <p className="text-muted-foreground text-xs">
              Select granular permissions to control feature and action access.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-1 py-4 text-xs">
            {/* Role details */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-foreground mb-1 block font-semibold">
                  Role Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Senior Support Agent"
                  className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-3 py-1.5 focus:ring-1 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-foreground mb-1 block font-semibold">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Handles customer questions and utility messages"
                  className="border-border bg-background text-foreground focus:ring-cf-orange w-full rounded border px-3 py-1.5 focus:ring-1 focus:outline-none"
                />
              </div>
            </div>

            {/* Presets shortcut buttons */}
            <div>
              <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
                Quick Apply Preset
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PERMISSIONS_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer rounded border px-2 py-1 text-[11px] font-medium transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Permissions Categories Matrix */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-foreground font-bold">
                  Granular Permissions
                </span>
                <span className="text-cf-orange font-semibold">
                  {selectedPerms.size} of {ALL_PERMISSIONS.length} selected
                </span>
              </div>

              {PERMISSION_CATEGORIES.map((cat) => (
                <div
                  key={cat.name}
                  className="border-border bg-card/60 rounded-md border p-3"
                >
                  <div className="text-foreground mb-2 flex items-center justify-between font-semibold">
                    <span>{cat.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = cat.permissions.every((p) =>
                          selectedPerms.has(p)
                        );
                        setSelectedPerms((prev) => {
                          const next = new Set(prev);
                          cat.permissions.forEach((p) => {
                            if (allSelected) next.delete(p);
                            else next.add(p);
                          });
                          return next;
                        });
                      }}
                      className="text-cf-orange cursor-pointer text-[10px] hover:underline"
                    >
                      {cat.permissions.every((p) => selectedPerms.has(p))
                        ? "Deselect Category"
                        : "Select Category"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {cat.permissions.map((perm) => {
                      const isChecked = selectedPerms.has(perm);
                      const label = PERMISSION_LABELS[perm];

                      return (
                        <label
                          key={perm}
                          className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded p-1.5 transition-colors select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(perm)}
                            className="accent-cf-orange size-3.5 cursor-pointer rounded"
                          />
                          <span
                            className={
                              isChecked
                                ? "text-foreground font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-cf-orange cursor-pointer text-white hover:bg-[#e87516]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Saving...
                </>
              ) : role ? (
                "Save Role Permissions"
              ) : (
                "Create Role"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
