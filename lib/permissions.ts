export enum PERMISSIONS {
  // ── Customers (1-19) ──────────────────────────────────────────────────────
  CUSTOMER_VIEW = 1, // View customer profiles and contact list
  CUSTOMER_CREATE = 2, // Create new customer records
  CUSTOMER_EDIT = 3, // Edit customer details, notes, state, and tags
  CUSTOMER_DELETE = 4, // Permanently delete customer records
  CUSTOMER_IMPORT = 5, // Import customers via CSV
  CUSTOMER_EXPORT = 6, // Export customer data to CSV
  CUSTOMER_ASSIGN = 7, // Distribute and assign customers to staff members

  // ── Conversations & 1-on-1 Messaging (20-39) ─────────────────────────────
  CONVERSATION_VIEW = 20, // View chat conversations and message history
  MESSAGE_SEND = 21, // Send custom session text & media messages
  MESSAGE_SEND_UTILITY = 22, // Send utility template messages
  MESSAGE_SEND_MARKETING = 23, // Send marketing template messages

  // ── Templates (40-59) ────────────────────────────────────────────────────
  TEMPLATE_VIEW = 40, // View approved WhatsApp templates
  TEMPLATE_CREATE = 41, // Add / create / sync new message templates
  TEMPLATE_EDIT = 42, // Edit message templates
  TEMPLATE_DELETE = 43, // Delete message templates

  // ── Bulk & Broadcast (60-79) ─────────────────────────────────────────────
  BULK_JOB_VIEW = 60, // View broadcast jobs & recipient logs
  BULK_MESSAGE_SEND = 61, // Send bulk custom messages
  BULK_UTILITY_SEND = 62, // Send bulk utility template messages
  BULK_MARKETING_SEND = 63, // Send bulk marketing template messages
  BULK_JOB_CANCEL = 64, // Cancel ongoing broadcast jobs

  // ── Staff & Roles Management (80-99) ─────────────────────────────────────
  STAFF_VIEW = 80, // View staff members list and profiles
  STAFF_MANAGE = 81, // Create, update, or deactivate staff accounts
  ROLE_VIEW = 82, // View roles and their permission assignments
  ROLE_MANAGE = 83, // Create, update, or delete roles

  // ── Settings (100-119) ───────────────────────────────────────────────────
  SETTINGS_VIEW = 100, // View business & WhatsApp settings
  SETTINGS_MANAGE = 101, // Manage business & integration settings

  // ── Workflows & Automation (120-139) ──────────────────────────────────────
  WORKFLOW_VIEW = 120, // View interactive workflows & executions
  WORKFLOW_MANAGE = 121 // Create, update, toggle and delete workflows
}

export const PERMISSION_LABELS: Record<PERMISSIONS, string> = {
  // Customers
  [PERMISSIONS.CUSTOMER_VIEW]: "View Customers",
  [PERMISSIONS.CUSTOMER_CREATE]: "Add Customer",
  [PERMISSIONS.CUSTOMER_EDIT]: "Update Customer",
  [PERMISSIONS.CUSTOMER_DELETE]: "Delete Customer",
  [PERMISSIONS.CUSTOMER_IMPORT]: "Import Customers",
  [PERMISSIONS.CUSTOMER_EXPORT]: "Export Customers",
  [PERMISSIONS.CUSTOMER_ASSIGN]: "Distribute & Assign Customers",

  // Messaging
  [PERMISSIONS.CONVERSATION_VIEW]: "View Conversations",
  [PERMISSIONS.MESSAGE_SEND]: "Send Conversation Message",
  [PERMISSIONS.MESSAGE_SEND_UTILITY]: "Send Utility Message",
  [PERMISSIONS.MESSAGE_SEND_MARKETING]: "Send Marketing Message",

  // Templates
  [PERMISSIONS.TEMPLATE_VIEW]: "View Templates",
  [PERMISSIONS.TEMPLATE_CREATE]: "Add Templates",
  [PERMISSIONS.TEMPLATE_EDIT]: "Edit Templates",
  [PERMISSIONS.TEMPLATE_DELETE]: "Delete Templates",

  // Bulk Messaging
  [PERMISSIONS.BULK_JOB_VIEW]: "View Bulk Jobs",
  [PERMISSIONS.BULK_MESSAGE_SEND]: "Send Bulk Messages",
  [PERMISSIONS.BULK_UTILITY_SEND]: "Send Bulk Utility",
  [PERMISSIONS.BULK_MARKETING_SEND]: "Send Bulk Marketing",
  [PERMISSIONS.BULK_JOB_CANCEL]: "Cancel Bulk Jobs",

  // Staff & Roles
  [PERMISSIONS.STAFF_VIEW]: "View Staff",
  [PERMISSIONS.STAFF_MANAGE]: "Manage Staff",
  [PERMISSIONS.ROLE_VIEW]: "View Roles",
  [PERMISSIONS.ROLE_MANAGE]: "Manage Roles",

  // Settings
  [PERMISSIONS.SETTINGS_VIEW]: "View Settings",
  [PERMISSIONS.SETTINGS_MANAGE]: "Manage Settings",

  // Workflows & Automation
  [PERMISSIONS.WORKFLOW_VIEW]: "View Workflows",
  [PERMISSIONS.WORKFLOW_MANAGE]: "Manage Workflows"
};

export interface PermissionCategory {
  name: string;
  permissions: PERMISSIONS[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    name: "Customers",
    permissions: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_EDIT,
      PERMISSIONS.CUSTOMER_DELETE,
      PERMISSIONS.CUSTOMER_IMPORT,
      PERMISSIONS.CUSTOMER_EXPORT,
      PERMISSIONS.CUSTOMER_ASSIGN
    ]
  },
  {
    name: "1-on-1 Messaging",
    permissions: [
      PERMISSIONS.CONVERSATION_VIEW,
      PERMISSIONS.MESSAGE_SEND,
      PERMISSIONS.MESSAGE_SEND_UTILITY,
      PERMISSIONS.MESSAGE_SEND_MARKETING
    ]
  },
  {
    name: "Templates",
    permissions: [
      PERMISSIONS.TEMPLATE_VIEW,
      PERMISSIONS.TEMPLATE_CREATE,
      PERMISSIONS.TEMPLATE_EDIT,
      PERMISSIONS.TEMPLATE_DELETE
    ]
  },
  {
    name: "Bulk Broadcast",
    permissions: [
      PERMISSIONS.BULK_JOB_VIEW,
      PERMISSIONS.BULK_MESSAGE_SEND,
      PERMISSIONS.BULK_UTILITY_SEND,
      PERMISSIONS.BULK_MARKETING_SEND,
      PERMISSIONS.BULK_JOB_CANCEL
    ]
  },
  {
    name: "Workflows & Automation",
    permissions: [PERMISSIONS.WORKFLOW_VIEW, PERMISSIONS.WORKFLOW_MANAGE]
  },
  {
    name: "Staff & Roles",
    permissions: [
      PERMISSIONS.STAFF_VIEW,
      PERMISSIONS.STAFF_MANAGE,
      PERMISSIONS.ROLE_VIEW,
      PERMISSIONS.ROLE_MANAGE
    ]
  },
  {
    name: "Settings",
    permissions: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_MANAGE]
  }
];

export interface PermissionPreset {
  label: string;
  description: string;
  perms: PERMISSIONS[] | "all" | "none";
}

export const PERMISSIONS_PRESETS: PermissionPreset[] = [
  {
    label: "Administrator",
    description:
      "Unrestricted access across all CRM features, staff, and roles",
    perms: "all"
  },
  {
    label: "Manager",
    description:
      "Manage customers, messages, templates, broadcasts, and view staff",
    perms: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_EDIT,
      PERMISSIONS.CUSTOMER_EXPORT,
      PERMISSIONS.CUSTOMER_IMPORT,
      PERMISSIONS.CUSTOMER_ASSIGN,
      PERMISSIONS.CONVERSATION_VIEW,
      PERMISSIONS.MESSAGE_SEND,
      PERMISSIONS.MESSAGE_SEND_UTILITY,
      PERMISSIONS.MESSAGE_SEND_MARKETING,
      PERMISSIONS.TEMPLATE_VIEW,
      PERMISSIONS.TEMPLATE_CREATE,
      PERMISSIONS.TEMPLATE_EDIT,
      PERMISSIONS.BULK_JOB_VIEW,
      PERMISSIONS.BULK_MESSAGE_SEND,
      PERMISSIONS.BULK_UTILITY_SEND,
      PERMISSIONS.BULK_MARKETING_SEND,
      PERMISSIONS.BULK_JOB_CANCEL,
      PERMISSIONS.STAFF_VIEW,
      PERMISSIONS.ROLE_VIEW,
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.WORKFLOW_VIEW,
      PERMISSIONS.WORKFLOW_MANAGE
    ]
  },
  {
    label: "Support Agent",
    description:
      "View customers, send session messages and utility notifications",
    perms: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_EDIT,
      PERMISSIONS.CONVERSATION_VIEW,
      PERMISSIONS.MESSAGE_SEND,
      PERMISSIONS.MESSAGE_SEND_UTILITY,
      PERMISSIONS.TEMPLATE_VIEW
    ]
  },
  {
    label: "Marketing Agent",
    description:
      "Manage marketing broadcasts, templates, and view customer contacts",
    perms: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CONVERSATION_VIEW,
      PERMISSIONS.MESSAGE_SEND_MARKETING,
      PERMISSIONS.TEMPLATE_VIEW,
      PERMISSIONS.TEMPLATE_CREATE,
      PERMISSIONS.BULK_JOB_VIEW,
      PERMISSIONS.BULK_MARKETING_SEND
    ]
  },
  {
    label: "Auditor / Read-Only",
    description:
      "Read-only access to customer logs, conversations, and reports",
    perms: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CONVERSATION_VIEW,
      PERMISSIONS.TEMPLATE_VIEW,
      PERMISSIONS.BULK_JOB_VIEW,
      PERMISSIONS.STAFF_VIEW,
      PERMISSIONS.ROLE_VIEW,
      PERMISSIONS.SETTINGS_VIEW
    ]
  },
  {
    label: "Clear All",
    description: "Remove all assigned permissions",
    perms: "none"
  }
];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS).filter(
  (v): v is PERMISSIONS => typeof v === "number"
);

export const normalizePermission = (
  permission: PERMISSIONS | number | string
): PERMISSIONS | undefined => {
  const value =
    typeof permission === "string" ? Number(permission) : permission;

  return Number.isFinite(value) && value in PERMISSION_LABELS
    ? (value as PERMISSIONS)
    : undefined;
};

/**
 * Checks if a single permission equals the required permission.
 */
export const isPermission = (
  permission: PERMISSIONS,
  required: PERMISSIONS
): boolean => normalizePermission(permission) === required;

/**
 * Checks if a list contains a permission.
 */
export const hasPermission = (
  permissions: PERMISSIONS[] | number[] | undefined | null,
  required: PERMISSIONS
): boolean => {
  if (!permissions || !Array.isArray(permissions)) return false;
  return permissions.some(
    (permission) => normalizePermission(permission) === required
  );
};

/**
 * Checks if user has all permissions.
 */
export const hasAllPermissions = (
  permissions: PERMISSIONS[] | number[] | undefined | null,
  required: PERMISSIONS[]
): boolean =>
  required.every((permission) => hasPermission(permissions, permission));

/**
 * Checks if user has any permission.
 */
export const hasAnyPermission = (
  permissions: PERMISSIONS[] | number[] | undefined | null,
  required: PERMISSIONS[]
): boolean =>
  required.some((permission) => hasPermission(permissions, permission));

/**
 * Returns only valid permissions.
 */
export const normalizePermissions = (
  permissions: (PERMISSIONS | number | string)[]
): PERMISSIONS[] =>
  permissions
    .map(normalizePermission)
    .filter(
      (permission): permission is PERMISSIONS => permission !== undefined
    );

/**
 * Removes duplicate permissions.
 */
export const uniquePermissions = (
  permissions: (PERMISSIONS | number | string)[]
): PERMISSIONS[] => [...new Set(normalizePermissions(permissions))];

/**
 * Returns permissions missing from the user.
 */
export const missingPermissions = (
  permissions: PERMISSIONS[] | number[] | undefined | null,
  required: PERMISSIONS[]
): PERMISSIONS[] =>
  required.filter((permission) => !hasPermission(permissions, permission));

/**
 * Identifies whoever is performing a role change, so grants can be limited to
 * what that actor actually holds.
 */
export type PermissionActor = {
  /** True for the tenant owner/admin, who is not permission-gated. */
  isOwner: boolean;
  permissions: PERMISSIONS[];
};

/**
 * Permissions an actor is trying to grant but doesn't hold themselves.
 */
export const ungrantablePermissions = (
  actor: PermissionActor,
  requested: PERMISSIONS[]
): PERMISSIONS[] =>
  actor.isOwner ? [] : missingPermissions(actor.permissions, requested);

/**
 * Returns true if user has every permission.
 */
export const isAdministrator = (
  permissions: PERMISSIONS[] | number[] | undefined | null
): boolean => {
  if (!permissions) return false;
  return ALL_PERMISSIONS.every((permission) =>
    hasPermission(permissions, permission)
  );
};
