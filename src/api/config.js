const env = import.meta.env ?? {};

const defaultClusterTypes = [
  "EVENTMESH_JVM_CLUSTER",
  "EVENTMESH_CLUSTER",
  "STORAGE_ROCKETMQ_CLUSTER",
  "STORAGE_KAFKA_CLUSTER",
];

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const apiConfig = Object.freeze({
  baseURL: env.VITE_EVENTMESH_API_BASE_URL || "/eventmesh/dashboard",
  timeoutMs: positiveNumber(env.VITE_EVENTMESH_API_TIMEOUT_MS, 3500),
  organizationId: positiveNumber(env.VITE_EVENTMESH_ORGANIZATION_ID, 1),
  clusterType: env.VITE_EVENTMESH_CLUSTER_TYPE || "EVENTMESH_JVM_CLUSTER",
  clusterTypes: Object.freeze((env.VITE_EVENTMESH_CLUSTER_TYPES
    ? String(env.VITE_EVENTMESH_CLUSTER_TYPES).split(",")
    : defaultClusterTypes).map((value) => value.trim()).filter(Boolean)),
});
