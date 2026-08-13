import axios from "axios";
import { apiConfig } from "./config.js";
import { unwrapPayload } from "./contracts.js";
import { accessToken, clearSession, readSession, writeSession } from "./session.js";

export const apiClient = axios.create({
  baseURL: apiConfig.baseURL,
  timeout: apiConfig.timeoutMs,
  headers: {
    "Content-Type": "application/json",
    queryClause: JSON.stringify({ limitPageNum: 1, limitSize: 200 }),
  },
});

apiClient.interceptors.request.use((config) => {
  const token = accessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise = null;

apiClient.interceptors.response.use((response) => response, async (error) => {
  const original = error.config;
  const requestPath = String(original?.url ?? "");
  const isAuthMutation = ["/auth/login", "/auth/refresh", "/auth/logout"].some((path) => requestPath.endsWith(path));
  if (error.response?.status !== 401 || original?._retried || isAuthMutation) throw error;
  const session = readSession();
  if (!session?.refreshToken) {
    clearSession();
    throw error;
  }
  try {
    refreshPromise ??= axios.post(`${apiConfig.baseURL}/auth/refresh`, {
      refreshToken: session.refreshToken,
      organizationId: session.currentOrganizationId,
    }, { timeout: apiConfig.timeoutMs }).then(({ data }) => writeSession(unwrapPayload(data))).finally(() => { refreshPromise = null; });
    const refreshed = await refreshPromise;
    original._retried = true;
    original.headers.Authorization = `Bearer ${refreshed.accessToken}`;
    return apiClient(original);
  } catch (refreshError) {
    clearSession();
    throw refreshError;
  }
});
