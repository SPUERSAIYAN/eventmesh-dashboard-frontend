import { createContext, useContext, useMemo } from "react";
import { getRoleDefinition, roleCan } from "./permissions.js";
import { useAuth } from "./AuthProvider.jsx";

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const { currentRole: role } = useAuth();
  const value = useMemo(() => ({
    role,
    roleDefinition: getRoleDefinition(role),
    can: (permission) => roleCan(role, permission),
  }), [role]);
  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) throw new Error("usePermissions must be used inside PermissionProvider");
  return context;
}
