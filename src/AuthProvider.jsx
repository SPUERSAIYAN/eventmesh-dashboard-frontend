import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "./api/client.js";
import { unwrapPayload } from "./api/contracts.js";
import { clearSession, onSessionChange, readSession, writeSession } from "./api/session.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);
  const [checking, setChecking] = useState(Boolean(readSession()?.accessToken));

  useEffect(() => onSessionChange(setSession), []);

  useEffect(() => {
    let active = true;
    if (!session?.accessToken) {
      setChecking(false);
      return () => { active = false; };
    }
    setChecking(true);
    apiClient.get("/auth/me").then(({ data }) => {
      if (!active) return;
      const current = readSession();
      writeSession({ ...current, ...unwrapPayload(data), accessToken: current?.accessToken, refreshToken: current?.refreshToken, expiresAt: current?.expiresAt });
    }).catch(() => {
      if (active && !readSession()?.accessToken) clearSession();
    }).finally(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (username, password) => {
    const { data } = await apiClient.post("/auth/login", { username, password });
    return writeSession(unwrapPayload(data));
  }, []);

  const logout = useCallback(async () => {
    const current = readSession();
    try {
      if (current?.refreshToken) await apiClient.post("/auth/logout", { refreshToken: current.refreshToken });
    } finally {
      clearSession();
    }
  }, []);

  const switchOrganization = useCallback(async (organizationId) => {
    const current = readSession();
    const { data } = await apiClient.post("/auth/refresh", { refreshToken: current?.refreshToken, organizationId });
    return writeSession(unwrapPayload(data));
  }, []);

  const value = useMemo(() => ({
    session,
    checking,
    authenticated: Boolean(session?.accessToken),
    user: session?.user ?? null,
    organizations: session?.organizations ?? [],
    currentOrganizationId: session?.currentOrganizationId ?? null,
    currentRole: session?.currentRole ?? null,
    login,
    logout,
    switchOrganization,
  }), [checking, login, logout, session, switchOrganization]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
