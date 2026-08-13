import { apiClient } from "./client.js";
import { apiConfig } from "./config.js";
import { activeOrganizationId } from "./session.js";
import { clusterEntitySchema, healthProportionSchema, parseArray, parseObject, runtimeEntitySchema, unwrapPayload } from "./contracts.js";
import { z } from "zod";

const passthroughItemSchema = z.unknown();

export const dashboardEndpoints = Object.freeze({
  clusters: "/user/cluster/queryClusterByOrganizationIdAndType",
  runtimes: "/runtime/queryRuntimeListByClusterId",
  topics: "/user/topic/queryTopicListByClusterId",
  groups: "/user/group/queryGroupListByClusterId",
  health: "/cluster/health/getInstanceLiveProportion",
  connections: "/netConnection",
  operations: "/cluster/log/getList",
  createCluster: "/organization/activeCreate/createCluster",
});

function errorMessage(error) {
  if (error?.code === "ECONNABORTED") return `API request timed out after ${apiConfig.timeoutMs} ms`;
  if (error?.response?.status) return `API returned HTTP ${error.response.status}`;
  return error?.message || "EventMesh Dashboard API is unavailable";
}

function numberId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeStatus(status, fallback = "Healthy") {
  if (status == null) return fallback;
  if (typeof status === "number") return status === 0 ? "Warning" : "Healthy";
  const normalized = String(status).toLowerCase();
  if (["healthy", "running", "online", "success", "started", "normal", "1", "true"].some((value) => normalized.includes(value))) return "Healthy";
  if (["warning", "abnormal", "failed", "error", "offline", "stopped", "0", "false"].some((value) => normalized.includes(value))) return "Warning";
  return fallback;
}

function formatDate(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace("T", " ").slice(0, 16);
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function uptimeFrom(value, fallback) {
  if (!value) return fallback;
  const startedAt = new Date(value).getTime();
  if (!Number.isFinite(startedAt) || startedAt > Date.now()) return fallback;
  const hours = Math.floor((Date.now() - startedAt) / 3_600_000);
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function mapRuntime(entity, index, connectionCounts = new Map()) {
  return {
    id: String(entity.id ?? entity.name ?? `runtime-${index + 1}`),
    name: entity.name ?? `runtime-${index + 1}`,
    host: entity.host ?? null,
    port: entity.port ?? null,
    status: normalizeStatus(entity.status ?? entity.deployStatusType, "Healthy"),
    cpu: null,
    memory: null,
    connections: connectionCounts.get(String(entity.id)) ?? 0,
  };
}

function jsonObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function clusterConfig(entity) {
  return jsonObject(entity?.config);
}

function metricRate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)}K` : null;
}

function mapOperation(item) {
  const state = Number(item.state);
  return {
    type: state === 2 ? "success" : state === 3 ? "warning" : "info",
    title: item.content || `${item.operationType ?? "Operation"} ${item.targetType ?? ""}`.trim(),
    detail: item.result || "No result supplied",
    time: formatDate(item.createTime, "—"),
  };
}

function mapCluster(entity, index, enrichment = {}) {
  const config = clusterConfig(entity);
  const backendId = numberId(entity.id ?? entity.clusterId);
  const health = enrichment.health;
  const allHealthChecks = health?.allNum ?? enrichment.runtimes?.length;
  const abnormalChecks = health?.abnormalNum;
  const score = Number.isFinite(allHealthChecks) && allHealthChecks > 0 && Number.isFinite(abnormalChecks)
    ? Math.max(0, Math.round(((allHealthChecks - abnormalChecks) / allHealthChecks) * 100))
    : null;
  return {
    id: backendId ? String(backendId) : String(entity.name ?? `cluster-${index + 1}`),
    backendId,
    name: entity.name ?? `Cluster ${index + 1}`,
    status: abnormalChecks > 0 ? "Warning" : normalizeStatus(entity.status ?? entity.deployStatusType, "Warning"),
    score,
    version: entity.version ?? "—",
    description: entity.description ?? "—",
    clusterId: backendId ? `#${backendId}` : "—",
    uptime: uptimeFrom(entity.startTimestamp ?? entity.onlineTimestamp, "—"),
    created: formatDate(entity.createTime, "—"),
    region: config.region ?? "—",
    runtimes: enrichment.runtimes?.length ?? null,
    topics: enrichment.topics?.length ?? null,
    groups: enrichment.groups?.length ?? null,
    inbound: null,
    outbound: null,
    raw: entity,
  };
}

async function settled(loader) {
  try {
    return { ok: true, data: await loader() };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

function sourceFrom(results, hasUnavailableFields = false) {
  const values = Object.values(results);
  if (hasUnavailableFields || values.some((result) => !result?.ok)) return "mixed";
  return "live";
}

function fallbackReason(results) {
  return Object.entries(results).filter(([, result]) => result && !result.ok).map(([name, result]) => `${name}: ${result.error}`).join("; ") || null;
}

export function createDashboardRepository(client = apiClient) {
  const organizationId = () => activeOrganizationId() ?? apiConfig.organizationId;

  async function fetchClusterEntities() {
    const response = await client.post(dashboardEndpoints.clusters, { organizationId: organizationId(), clusterType: apiConfig.clusterType });
    return parseArray(clusterEntitySchema, response.data, "cluster list");
  }

  async function fetchRuntimes(clusterId) {
    const response = await client.post(dashboardEndpoints.runtimes, { clusterId, organizationId: organizationId(), clusterType: apiConfig.clusterType });
    return parseArray(runtimeEntitySchema, response.data, "runtime list");
  }

  async function fetchTopics(clusterId) {
    const response = await client.post(dashboardEndpoints.topics, { clusterId, organizationId: organizationId(), clusterType: apiConfig.clusterType, topicName: null });
    return parseArray(passthroughItemSchema, response.data, "topic list");
  }

  async function fetchGroups(clusterId) {
    const response = await client.post(dashboardEndpoints.groups, { clusterId, organizationId: organizationId(), clusterType: apiConfig.clusterType });
    return parseArray(passthroughItemSchema, response.data, "group list");
  }

  async function fetchHealth(clusterId) {
    const response = await client.get(dashboardEndpoints.health, { params: { instanceType: 2, theClusterId: clusterId } });
    return parseObject(healthProportionSchema, response.data, "health proportion");
  }

  async function fetchConnections(clusterId) {
    const response = await client.post(dashboardEndpoints.connections, { clusterId });
    return parseArray(passthroughItemSchema, response.data, "connection list");
  }

  async function fetchOperations(clusterId) {
    const response = await client.post(dashboardEndpoints.operations, { clusterId });
    return parseArray(passthroughItemSchema, response.data, "operation list");
  }

  async function enrich(entity, index = 0, { includeOperations = true } = {}) {
    const clusterId = numberId(entity.id ?? entity.clusterId);
    if (!clusterId) throw new Error("cluster response does not contain a numeric id");
    const [runtimesResult, topicsResult, groupsResult, healthResult, connectionsResult, operationsResult] = await Promise.all([
      settled(() => fetchRuntimes(clusterId)), settled(() => fetchTopics(clusterId)), settled(() => fetchGroups(clusterId)), settled(() => fetchHealth(clusterId)),
      settled(() => fetchConnections(clusterId)), includeOperations ? settled(() => fetchOperations(clusterId)) : Promise.resolve({ ok: false, skipped: true, error: "Not requested" }),
    ]);
    const results = { runtimes: runtimesResult, topics: topicsResult, groups: groupsResult, health: healthResult, connections: connectionsResult, operations: operationsResult };
    const cluster = mapCluster(entity, index, {
      runtimes: runtimesResult.ok ? runtimesResult.data : undefined,
      topics: topicsResult.ok ? topicsResult.data : undefined,
      groups: groupsResult.ok ? groupsResult.data : undefined,
      health: healthResult.ok ? healthResult.data : undefined,
    });
    return { cluster, results };
  }

  return {
    async createCluster(input) {
      const response = await client.post(dashboardEndpoints.createCluster, {
        organizationId: organizationId(),
        clusterType: input.clusterType || apiConfig.clusterType,
        name: input.name.trim(),
        version: input.version.trim(),
        description: input.description.trim(),
        firstToWhom: "DASHBOARD",
        trusteeshipArrangeType: "SELF",
      });
      const id = unwrapPayload(response.data);
      if (id == null || !["number", "string"].includes(typeof id)) throw new Error("Create cluster API did not return a cluster ID");
      return { id: String(id), name: input.name.trim() };
    },

    async getClusters() {
      const entities = await fetchClusterEntities();
        if (!entities.length) {
          return {
            data: [],
            meta: { source: "live", fallbackReason: null, sources: { clusters: "api", summaries: "api" }, fetchedAt: new Date().toISOString() },
          };
        }
        const enriched = await Promise.all(entities.map((entity, index) => enrich(entity, index, { includeOperations: false })));
        const allResults = Object.fromEntries(enriched.flatMap(({ cluster, results }) => Object.entries(results).map(([key, value]) => [`${cluster.id}.${key}`, value])));
        return {
          data: enriched.map((item) => item.cluster),
          meta: { source: sourceFrom(allResults, true), fallbackReason: fallbackReason(allResults), sources: { clusters: "api", summaries: sourceFrom(allResults) }, fetchedAt: new Date().toISOString() },
        };
    },

    async getClusterDashboard(routeId, { includeOperations = true } = {}) {
      const entities = await fetchClusterEntities();
        const entity = entities.find((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
        if (!entity) throw new Error(`cluster ${routeId} was not returned by the API`);
        const { cluster, results } = await enrich(entity, Math.max(0, entities.indexOf(entity)), { includeOperations });
        const connectionCounts = new Map();
        if (results.connections.ok) results.connections.data.forEach((connection) => connectionCounts.set(String(connection.runtimeId), (connectionCounts.get(String(connection.runtimeId)) ?? 0) + 1));
        const runtimesData = results.runtimes.ok ? results.runtimes.data.map((runtime, index) => mapRuntime(runtime, index, connectionCounts)) : [];
        return {
          data: {
            cluster,
            runtimes: runtimesData,
            topicCount: results.topics.ok ? results.topics.data.length : cluster.topics,
            groupCount: results.groups.ok ? results.groups.data.length : cluster.groups,
            connectionCount: results.connections.ok ? results.connections.data.length : null,
            recentChanges: results.operations.ok ? results.operations.data.map(mapOperation) : [],
          },
          meta: {
            source: sourceFrom({ cluster: { ok: true }, ...results }, true),
            fallbackReason: fallbackReason(results),
            sources: {
              cluster: "api",
              runtimes: results.runtimes.ok ? "api" : "unavailable",
              topics: results.topics.ok ? "api" : "unavailable",
              groups: results.groups.ok ? "api" : "unavailable",
              health: results.health.ok ? "api" : "unavailable",
              throughput: cluster.inbound && cluster.outbound ? "api" : "unavailable",
              changes: results.operations.ok ? "api" : "unavailable",
            },
            fetchedAt: new Date().toISOString(),
          },
        };
    },
  };
}

export const dashboardRepository = createDashboardRepository();
export const clusterListPlaceholder = { data: [], meta: { source: "loading", fallbackReason: null, sources: {}, fetchedAt: null } };
export const clusterDetailPlaceholder = (routeId) => ({
  data: {
    cluster: { id: String(routeId), name: String(routeId), status: "Unknown", score: null, version: "—", clusterId: "—", uptime: "—", created: "—", region: "—" },
    runtimes: [], topicCount: 0, groupCount: 0, connectionCount: 0, recentChanges: [],
  },
  meta: { source: "loading", fallbackReason: null, sources: {}, fetchedAt: null },
});
