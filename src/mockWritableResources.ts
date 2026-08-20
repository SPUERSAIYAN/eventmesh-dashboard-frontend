export const MOCK_WRITABLE_RESOURCE_KEY = "eventmesh-mock-writable-resources-v1";

export const defaultWritableResourceState = () => ({ version: 1, nodes: [], topics: [], physicalTopics: [], consumers: [] });

export function normalizeWritableResourceState(value) {
  if (!value || typeof value !== "object" || value.version !== 1) return defaultWritableResourceState();
  return {
    version: 1,
    nodes: Array.isArray(value.nodes) ? value.nodes : [],
    topics: Array.isArray(value.topics) ? value.topics : [],
    physicalTopics: Array.isArray(value.physicalTopics) ? value.physicalTopics : [],
    consumers: Array.isArray(value.consumers) ? value.consumers : [],
  };
}

function appendUnique(state, key, item, identity) {
  if (state[key].some((candidate) => identity(candidate) === identity(item))) return state;
  return { ...state, [key]: [...state[key], item] };
}

export function addWritableNode(state, item) { return appendUnique(state, "nodes", item, (value) => `${value.clusterId}:${value.name}`); }
export function addWritablePhysicalTopic(state, item) { return appendUnique(state, "physicalTopics", item, (value) => `${value.storageClusterId}:${value.name}`); }
export function addWritableConsumer(state, item) { return appendUnique(state, "consumers", item, (value) => `${value.eventMeshClusterId}:${value.name}`); }
export function addWritableTopic(state, item) {
  const next = appendUnique(state, "topics", item, (value) => `${value.eventMeshClusterId}:${value.name}`);
  if (next === state) return state;
  return addWritablePhysicalTopic(next, {
    id: `physical-${item.id}`,
    storageClusterId: item.storageClusterId,
    engine: item.engine,
    name: item.name,
    partitions: item.partitions,
    replicas: item.replicas,
    inRate: "0/s",
    outRate: "0/s",
    storage: "0 GB",
    status: "healthy",
    createdAt: item.createdAt,
    source: "eventmesh",
  });
}

export function ensureSimName(value, fallback) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized) return fallback;
  return normalized.startsWith("codex-sim-") ? normalized : `codex-sim-${normalized}`;
}
