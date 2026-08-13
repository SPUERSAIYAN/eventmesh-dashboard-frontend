const STORAGE_KEY = "eventmesh-session";
const SESSION_EVENT = "eventmesh-session-change";

function storage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function readSession() {
  try {
    const value = storage()?.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function writeSession(session) {
  const next = session ? {
    ...session,
    expiresAt: session.expiresAt ?? Date.now() + Number(session.expiresIn ?? 0) * 1_000,
  } : null;
  if (next) storage()?.setItem(STORAGE_KEY, JSON.stringify(next));
  else storage()?.removeItem(STORAGE_KEY);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: next }));
  return next;
}

export function clearSession() {
  writeSession(null);
}

export function accessToken() {
  return readSession()?.accessToken ?? null;
}

export function activeOrganizationId() {
  return readSession()?.currentOrganizationId ?? null;
}

export function onSessionChange(listener) {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => listener(event.detail);
  window.addEventListener(SESSION_EVENT, handler);
  return () => window.removeEventListener(SESSION_EVENT, handler);
}
