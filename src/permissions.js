export const ROLES = {
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  ORGANIZATION_OWNER: "ORGANIZATION_OWNER",
  ORGANIZATION_ADMIN: "ORGANIZATION_ADMIN",
  ORGANIZATION_MEMBER: "ORGANIZATION_MEMBER",
};

export const ROLE_DEFINITIONS = [
  { key: ROLES.SYSTEM_ADMIN, label: "System administrator", description: "Full system access across organizations." },
  { key: ROLES.ORGANIZATION_OWNER, label: "Organization owner", description: "Full control of the current organization and its roles." },
  { key: ROLES.ORGANIZATION_ADMIN, label: "Organization administrator", description: "Manages clusters, resources, and organization members." },
  { key: ROLES.ORGANIZATION_MEMBER, label: "Organization member", description: "Read-only access to operational resources." },
];

export const PERMISSIONS = {
  VIEW_CONSOLE: "console.view",
  CREATE_CLUSTER: "cluster.create",
  MANAGE_CLUSTER: "cluster.manage",
  VIEW_OPERATIONS: "operations.view",
  MANAGE_MEMBERS: "members.manage",
  ASSIGN_ROLES: "roles.assign",
  SYSTEM_SETTINGS: "system.settings",
};

const rolePermissions = {
  [ROLES.SYSTEM_ADMIN]: ["*"],
  [ROLES.ORGANIZATION_OWNER]: [
    PERMISSIONS.VIEW_CONSOLE,
    PERMISSIONS.CREATE_CLUSTER,
    PERMISSIONS.MANAGE_CLUSTER,
    PERMISSIONS.VIEW_OPERATIONS,
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.ASSIGN_ROLES,
  ],
  [ROLES.ORGANIZATION_ADMIN]: [
    PERMISSIONS.VIEW_CONSOLE,
    PERMISSIONS.CREATE_CLUSTER,
    PERMISSIONS.MANAGE_CLUSTER,
    PERMISSIONS.VIEW_OPERATIONS,
    PERMISSIONS.MANAGE_MEMBERS,
  ],
  [ROLES.ORGANIZATION_MEMBER]: [PERMISSIONS.VIEW_CONSOLE],
};

export function roleCan(role, permission) {
  const granted = rolePermissions[role] ?? [];
  return granted.includes("*") || granted.includes(permission);
}

export function getRoleDefinition(role) {
  return ROLE_DEFINITIONS.find((item) => item.key === role) ?? ROLE_DEFINITIONS[0];
}
