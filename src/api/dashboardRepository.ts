import { apiClient } from "./client.ts";
import { apiConfig } from "./config.ts";
import { clusterEntitySchema, parseArray, parseObject, runtimeEntitySchema, unwrapPayload } from "./contracts.ts";
import { z } from "zod";

const passthroughItemSchema = z.any();

const META_CLUSTER_TYPES = Object.freeze([
  "EVENTMESH_JVM_META",
  "EVENTMESH_META_NACOS",
  "EVENTMESH_META_ETCD",
]);

const STORAGE_CLUSTER_TYPES = Object.freeze([
  "STORAGE_KAFKA_CLUSTER",
  "STORAGE_ROCKETMQ_CLUSTER",
]);

export const dashboardEndpoints = Object.freeze({
  homepageClusters: "/user/cluster/queryVisualizationClusterByOrganizationIdAndType",
  clusters: "/user/cluster/queryClusterByOrganizationIdAndType",
  runtimes: "/runtime/queryRuntimeListByClusterId",
  topics: "/user/topic/queryTopicListByClusterId",
  groups: "/user/group/queryGroupListByClusterId",
  groupsByTopic: "/user/group/queryGroupListByTopicId",
  runtimeDetail: "/runtime/queryRuntimeListById",
  operations: "/cluster/log/getList",
  topology: "/user/cluster/queryTreeByClusterId",
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

function normalizeHost(value) {
  if (value == null || value === "") return null;
  const text = String(value);
  if (!/^\d+$/.test(text)) return text;
  const numeric = Number(text);
  if (!Number.isSafeInteger(numeric) || numeric <= 255 || numeric > 0xFFFFFFFF) return text;
  return [24, 16, 8, 0].map((shift) => Math.floor(numeric / (2 ** shift)) % 256).join(".");
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

function mapRuntime(entity, index) {
  return {
    id: String(entity.id ?? entity.name ?? `runtime-${index + 1}`),
    clusterId: entity.clusterId == null ? null : String(entity.clusterId),
    name: entity.name ?? `runtime-${index + 1}`,
    host: normalizeHost(entity.host),
    port: entity.port ?? null,
    jmxPort: entity.jmxPort ?? null,
    adminPort: entity.adminPort ?? null,
    rack: entity.rack ?? null,
    version: entity.version ?? "—",
    clusterType: entity.clusterType ?? "RUNTIME",
    status: normalizeStatus(entity.status ?? entity.deployStatusType, "Unknown"),
    deployStatus: entity.deployStatusType ?? null,
    replicationType: entity.replicationType ?? null,
    trusteeshipType: entity.trusteeshipType ?? null,
    kubernetesClusterId: entity.kubernetesClusterId ?? null,
    createTime: entity.createTime ?? null,
    updateTime: entity.updateTime ?? null,
    onlineTimestamp: entity.onlineTimestamp ?? null,
    cpu: null,
    memory: null,
    raw: entity,
  };
}

function rawTopologyChildren(node) {
  return [...(Array.isArray(node?.children) ? node.children : []), ...(Array.isArray(node?.runtime) ? node.runtime : [])]
    .filter((child) => child && typeof child === "object");
}

function normalizeTopologyNode(node, context, seen) {
  const runtimeNode = node.nodeType === "RUNTIME" || node.host != null || node.port != null;
  const id = String(node.id ?? node.clusterId ?? `${runtimeNode ? "runtime" : "cluster"}-${seen.size + 1}`);
  const key = `${runtimeNode ? "runtime" : "cluster"}-${id}`;
  if (seen.has(key)) return null;
  seen.add(key);
  const relation = runtimeNode ? "RUNTIME_MEMBER" : "CLUSTER_RELATIONSHIP";
  const current = {
    key,
    id,
    name: node.name ?? `${runtimeNode ? "Runtime" : "Cluster"} #${id}`,
    kind: runtimeNode ? "runtime" : "cluster",
    nodeType: node.nodeType ?? (runtimeNode ? "RUNTIME" : "CLUSTER"),
    clusterType: node.clusterType ?? (runtimeNode ? "RUNTIME" : "CLUSTER"),
    status: normalizeStatus(node.status ?? node.deployStatusType, "Unknown"),
    version: node.version ?? "—",
    host: normalizeHost(node.host),
    port: node.port ?? null,
    relation,
    parentId: context.parentId,
    parentName: context.parentName,
    description: node.description ?? null,
    children: [],
  };
  current.children = rawTopologyChildren(node).map((child) => normalizeTopologyNode(child, {
    parentId: current.id,
    parentName: current.name,
  }, seen)).filter(Boolean);
  return current;
}

export function buildClusterTopology(cluster, directRuntimes = [], relatedNodes = []) {
  const seen = new Set();
  const root = {
    key: `cluster-${cluster.id}`,
    id: String(cluster.id),
    name: cluster.name,
    kind: "cluster",
    nodeType: "CLUSTER",
    clusterType: cluster.raw?.clusterType ?? "EVENTMESH_JVM_CLUSTER",
    status: cluster.status,
    version: cluster.version,
    host: null,
    port: null,
    relation: "ROOT",
    parentId: null,
    parentName: null,
    description: cluster.description,
    children: [],
  };
  seen.add(root.key);
  const relationships = relatedNodes.map((node) => normalizeTopologyNode(node, {
    parentId: root.id,
    parentName: root.name,
  }, seen)).filter(Boolean);
  const runtimes = directRuntimes.map((runtime) => ({
    key: `runtime-${runtime.id}`,
    id: String(runtime.id),
    name: runtime.name ?? `Runtime #${runtime.id}`,
    kind: "runtime",
    nodeType: "RUNTIME",
    clusterType: runtime.clusterType ?? "RUNTIME",
    status: runtime.status,
    version: runtime.version ?? "—",
    host: runtime.host,
    port: runtime.port,
    relation: "DIRECT_RUNTIME",
    parentId: root.id,
    parentName: root.name,
    description: null,
    children: [],
  })).filter((runtime) => {
    if (seen.has(runtime.key)) return false;
    seen.add(runtime.key);
    return true;
  });
  const runtimeGroupStatus = runtimes.every((runtime) => runtime.status === "Healthy") ? "Healthy" : runtimes.some((runtime) => runtime.status === "Warning") ? "Warning" : "Unknown";
  const runtimeGroup = runtimes.length ? {
    key: `group-direct-runtimes-${root.id}`,
    id: null,
    name: "Direct runtimes",
    kind: "group",
    nodeType: "GROUP",
    clusterType: "RUNTIME_GROUP",
    status: runtimeGroupStatus,
    version: "—",
    host: null,
    port: null,
    relation: "DIRECT_RUNTIME_GROUP",
    parentId: root.id,
    parentName: root.name,
    description: null,
    children: runtimes,
  } : null;
  root.children = [...relationships, ...(runtimeGroup ? [runtimeGroup] : [])];
  return root;
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

function mapClusterReference(node) {
  const runtimeNode = node?.nodeType === "RUNTIME" || node?.host != null || node?.port != null;
  if (!node || runtimeNode) return null;
  const id = node.id ?? node.clusterId;
  if (id == null) return null;
  return {
    id: String(id),
    name: node.name ?? `Cluster #${id}`,
    clusterType: node.clusterType ?? "UNKNOWN",
    status: normalizeStatus(node.status ?? node.deployStatusType, "Unknown"),
  };
}

function topologyChildren(node) {
  return [...(Array.isArray(node?.children) ? node.children : []), ...(Array.isArray(node?.runtime) ? node.runtime : [])]
    .filter((child) => child && typeof child === "object");
}

function landscapeComponentType(clusterType) {
  const value = String(clusterType ?? "").toUpperCase();
  if (value.includes("META")) return "meta";
  if (value.includes("KAFKA")) return "kafka";
  if (value.includes("ROCKETMQ")) return "rocketmq";
  return "unknown";
}

function mapLandscapeNode(node, index) {
  return {
    id: String(node?.id ?? node?.runtimeId ?? node?.name ?? `node-${index + 1}`),
    name: node?.name ?? `Node ${index + 1}`,
    host: normalizeHost(node?.host),
    port: node?.port ?? null,
    version: node?.version ?? "—",
    clusterType: node?.clusterType ?? "UNKNOWN",
    status: normalizeStatus(node?.status ?? node?.deployStatusType, "Unknown"),
    deployStatus: node?.deployStatusType ?? null,
    replicationType: node?.replicationType ?? null,
    raw: node,
  };
}

function mapKafkaTopic(entity, index) {
  const readQueues = entity?.readQueueNum == null ? Number.NaN : Number(entity.readQueueNum);
  const writeQueues = entity?.writeQueueNum == null ? Number.NaN : Number(entity.writeQueueNum);
  const partitionCount = Number.isFinite(writeQueues) && writeQueues >= 0
    ? writeQueues
    : Number.isFinite(readQueues) && readQueues >= 0 ? readQueues : null;
  return {
    id: String(entity?.id ?? entity?.topicId ?? entity?.topicName ?? `topic-${index + 1}`),
    name: entity?.topicName ?? entity?.name ?? `Topic ${index + 1}`,
    topicType: entity?.topicType ?? null,
    readQueueNum: Number.isFinite(readQueues) ? readQueues : null,
    writeQueueNum: Number.isFinite(writeQueues) ? writeQueues : null,
    partitions: partitionCount,
    replicas: entity?.replicationFactor == null ? null : Number(entity.replicationFactor),
    retentionMs: entity?.retentionMs ?? null,
    description: entity?.description ?? "—",
    createTime: entity?.createTime ?? null,
    status: normalizeStatus(entity?.status, "Unknown"),
    raw: entity,
  };
}

function mapKafkaGroup(entity, index) {
  return {
    id: String(entity?.id ?? entity?.groupId ?? entity?.name ?? `group-${index + 1}`),
    name: entity?.name ?? entity?.groupName ?? `Consumer Group ${index + 1}`,
    type: entity?.type ?? null,
    ownType: entity?.ownType ?? null,
    runtimeId: entity?.runtimeId == null ? null : String(entity.runtimeId),
    createTime: entity?.createTime ?? null,
    status: normalizeStatus(entity?.status, "Unknown"),
    raw: entity,
  };
}

export function mapLandscapeComponent(node, index = 0) {
  const config = clusterConfig(node);
  const children = topologyChildren(node);
  const nodesAvailable = Array.isArray(node?.children) || Array.isArray(node?.runtime);
  return {
    id: String(node?.id ?? node?.clusterId ?? node?.name ?? `component-${index + 1}`),
    name: node?.name ?? `Component ${index + 1}`,
    description: node?.description ?? "—",
    type: landscapeComponentType(node?.clusterType),
    clusterType: node?.clusterType ?? "UNKNOWN",
    status: normalizeStatus(node?.status ?? node?.deployStatusType, "Unknown"),
    deployStatus: node?.deployStatusType ?? null,
    region: config.region ?? "—",
    version: node?.version ?? "—",
    nodes: children.map(mapLandscapeNode),
    nodesAvailable,
    raw: node,
  };
}

export function countMetaNodes(topology = []) {
  const nodeIds = new Set();
  let incompleteMetaTopology = false;
  const visit = (node, insideMetaCluster = false) => {
    if (!node || typeof node !== "object") return;
    const clusterType = String(node.clusterType ?? "").toUpperCase();
    const nodeType = String(node.nodeType ?? "").toUpperCase();
    const isRuntimeNode = nodeType === "RUNTIME" || node.host != null || node.port != null;
    const isMetaNode = clusterType.includes("META");
    const isMetaCluster = !isRuntimeNode && isMetaNode;
    if (isMetaCluster && !Array.isArray(node.children) && !Array.isArray(node.runtime)) {
      incompleteMetaTopology = true;
    }
    if (isRuntimeNode && (insideMetaCluster || isMetaNode)) {
      nodeIds.add(String(node.id ?? `${clusterType}:${node.name ?? nodeIds.size}`));
    }
    topologyChildren(node).forEach((child) => visit(child, insideMetaCluster || isMetaCluster));
  };
  (Array.isArray(topology) ? topology : []).forEach((node) => visit(node));
  return incompleteMetaTopology ? null : nodeIds.size;
}

function mapCluster(entity, index, enrichment: any = {}) {
  const config = clusterConfig(entity);
  const backendId = numberId(entity.id ?? entity.clusterId);
  return {
    id: backendId ? String(backendId) : String(entity.name ?? `cluster-${index + 1}`),
    backendId,
    name: entity.name ?? `Cluster ${index + 1}`,
    clusterType: entity.clusterType ?? apiConfig.clusterType,
    status: normalizeStatus(entity.status ?? entity.deployStatusType, "Unknown"),
    score: null,
    version: entity.version ?? "—",
    description: entity.description ?? "—",
    architecture: entity.replicationType ?? null,
    management: entity.trusteeshipType ?? null,
    sourceAuthority: entity.firstToWhom ?? null,
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

function sourceFrom(results: Record<string, any>, hasUnavailableFields = false) {
  const values = Object.values(results);
  if (hasUnavailableFields || values.some((result) => !result?.ok)) return "mixed";
  return "live";
}

function fallbackReason(results: Record<string, any>) {
  return Object.entries(results).filter(([, result]) => result && !result.ok).map(([name, result]) => `${name}: ${result.error}`).join("; ") || null;
}

async function collectClusterTypes(loader: (clusterType: string) => Promise<any[]>) {
  const results = await Promise.allSettled(apiConfig.clusterTypes.map(loader));
  const successful = results.filter((result) => result.status === "fulfilled");
  if (!successful.length) throw results.find((result) => result.status === "rejected")?.reason ?? new Error("Cluster APIs are unavailable");
  const unique = new Map<string, any>();
  successful.flatMap((result) => result.value).forEach((entity) => {
    const key = String(entity.id ?? entity.clusterId ?? `${entity.clusterType}:${entity.name}`);
    if (!unique.has(key)) unique.set(key, entity);
  });
  return [...unique.values()];
}

export function createDashboardRepository(client = apiClient) {
  const organizationId = () => apiConfig.organizationId;

  async function fetchClusterEntities() {
    return collectClusterTypes(async (clusterType) => {
      const response = await client.post(dashboardEndpoints.clusters, { organizationId: organizationId(), clusterType });
      return parseArray(clusterEntitySchema, response.data, `${clusterType} cluster list`);
    });
  }

  async function fetchRuntimes(clusterId, clusterType = apiConfig.clusterType) {
    const response = await client.post(dashboardEndpoints.runtimes, { clusterId, organizationId: organizationId(), clusterType });
    return parseArray(runtimeEntitySchema, response.data, "runtime list");
  }

  async function fetchTopics(clusterId, clusterType = apiConfig.clusterType) {
    const response = await client.post(dashboardEndpoints.topics, { clusterId, organizationId: organizationId(), clusterType, topicName: null });
    return parseArray(passthroughItemSchema, response.data, "topic list");
  }

  async function fetchGroups(clusterId, clusterType = apiConfig.clusterType) {
    const response = await client.post(dashboardEndpoints.groups, { clusterId, organizationId: organizationId(), clusterType });
    return parseArray(passthroughItemSchema, response.data, "group list");
  }

  async function fetchOperations(clusterId) {
    const response = await client.post(dashboardEndpoints.operations, { clusterId });
    return parseArray(passthroughItemSchema, response.data, "operation list");
  }

  async function fetchTopology(clusterId, clusterType = apiConfig.clusterType) {
    const response = await client.post(dashboardEndpoints.topology, {
      organizationId: organizationId(),
      clusterId,
      clusterType,
      deployStatusTypeList: [],
    });
    return parseArray(passthroughItemSchema, response.data, "cluster topology");
  }

  async function enrich(entity, index = 0, { includeOperations = true } = {}) {
    const clusterId = numberId(entity.id ?? entity.clusterId);
    if (!clusterId) throw new Error("cluster response does not contain a numeric id");
    const clusterType = entity.clusterType ?? apiConfig.clusterType;
    const [runtimesResult, topicsResult, groupsResult, operationsResult] = await Promise.all([
      settled(() => fetchRuntimes(clusterId, clusterType)), settled(() => fetchTopics(clusterId, clusterType)), settled(() => fetchGroups(clusterId, clusterType)),
      includeOperations ? settled(() => fetchOperations(clusterId)) : Promise.resolve({ ok: true, skipped: true, data: [] }),
    ]);
    const results = { runtimes: runtimesResult, topics: topicsResult, groups: groupsResult, operations: operationsResult };
    const cluster = mapCluster(entity, index, {
      runtimes: runtimesResult.ok ? runtimesResult.data : undefined,
      topics: topicsResult.ok ? topicsResult.data : undefined,
      groups: groupsResult.ok ? groupsResult.data : undefined,
    });
    return { cluster, results };
  }

  async function loadStorageEngineClusters(routeId, componentType, storageClusterType, engineName) {
    const [eventMeshResponse, kafkaInventoryResult] = await Promise.all([
      client.post(dashboardEndpoints.homepageClusters, {
        organizationId: organizationId(),
        clusterType: "EVENTMESH_JVM_CLUSTER",
      }),
      settled(async () => {
        const response = await client.post(dashboardEndpoints.clusters, {
          organizationId: organizationId(),
          clusterType: storageClusterType,
        });
        return parseArray(clusterEntitySchema, response.data, `${engineName} cluster list`);
      }),
    ]);
    const eventMeshEntities = parseArray(clusterEntitySchema, eventMeshResponse.data, "homepage cluster list");
    const currentIndex = eventMeshEntities.findIndex((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
    if (currentIndex < 0) throw new Error(`cluster ${routeId} was not returned by the API`);

    const topologyResults = await Promise.all(eventMeshEntities.map((entity) => {
      const clusterId = numberId(entity.id ?? entity.clusterId);
      if (!clusterId) return Promise.resolve({ ok: false, error: `cluster ${entity.name ?? "unknown"} does not contain a numeric id` });
      return settled(() => fetchTopology(clusterId, entity.clusterType ?? apiConfig.clusterType));
    }));
    const topologyKafkaMap = new Map();
    topologyResults.filter((result) => result.ok).flatMap((result) => result.data).filter((item) => landscapeComponentType(item.clusterType) === componentType).forEach((entity) => {
      const key = String(entity.id ?? entity.clusterId ?? entity.name);
      if (!topologyKafkaMap.has(key)) topologyKafkaMap.set(key, entity);
    });
    const kafkaEntityMap = new Map();
    if (kafkaInventoryResult.ok) kafkaInventoryResult.data.forEach((entity) => kafkaEntityMap.set(String(entity.id ?? entity.clusterId ?? entity.name), entity));
    topologyKafkaMap.forEach((entity, key) => kafkaEntityMap.set(key, { ...entity, ...(kafkaEntityMap.get(key) ?? {}) }));
    const kafkaEntities = [...kafkaEntityMap.values()];
    if (!kafkaEntities.length && !kafkaInventoryResult.ok) throw new Error(`${engineName} 集群查询失败：${kafkaInventoryResult.error}`);
    const brokerResults = await Promise.all(kafkaEntities.map((entity) => {
        const clusterId = numberId(entity.id ?? entity.clusterId);
        if (!clusterId) return Promise.resolve({ ok: false, error: `${engineName} cluster ${entity.name ?? "unknown"} does not contain a numeric id` });
        return settled(() => fetchRuntimes(clusterId, entity.clusterType ?? storageClusterType));
      }));
    const kafkaByEventMesh = topologyResults.map((result) => result.ok
      ? result.data.map(mapLandscapeComponent).filter((item) => item.type === componentType)
      : []);
    const references = new Map();
    kafkaByEventMesh.flat().forEach((item) => references.set(item.id, (references.get(item.id) ?? 0) + 1));
    const currentTopology = topologyResults[currentIndex];
    const currentIds = new Set(currentTopology.ok ? kafkaByEventMesh[currentIndex].map((item) => item.id) : []);
    const clusters = kafkaEntities.map((entity, index) => {
      const brokerResult = brokerResults[index];
      const component = mapLandscapeComponent({
        ...entity,
        children: brokerResult.ok && "data" in brokerResult ? brokerResult.data : undefined,
      }, index);
      const relatedEventMeshes = eventMeshEntities.flatMap((eventMesh, eventMeshIndex) => {
        if (!kafkaByEventMesh[eventMeshIndex]?.some((item) => item.id === component.id)) return [];
        const config = clusterConfig(eventMesh);
        return [{
          id: String(eventMesh.id ?? eventMesh.clusterId ?? eventMesh.name),
          routeId: String(eventMesh.name ?? eventMesh.id ?? eventMesh.clusterId),
          name: eventMesh.name ?? `EventMesh #${eventMesh.id ?? eventMesh.clusterId}`,
          description: eventMesh.description ?? "—",
          region: config.region ?? "—",
          deployStatus: eventMesh.deployStatusType ?? null,
        }];
      });
      return {
        ...component,
        referenceCount: references.get(component.id) ?? 0,
        currentAssociated: currentTopology.ok ? currentIds.has(component.id) : null,
        relatedEventMeshes,
      };
    });
    const warnings = [
      ...(kafkaInventoryResult.ok ? [] : [`${storageClusterType}：${kafkaInventoryResult.error}`]),
      ...topologyResults.flatMap((result, index) => result.ok ? [] : [`${eventMeshEntities[index]?.name ?? `EventMesh #${index + 1}`} 关联树：${result.error}`]),
      ...brokerResults.flatMap((result, index) => result.ok ? [] : [`${kafkaEntities[index]?.name ?? `${engineName} #${index + 1}`} Broker：${result.error}`]),
    ];
    return {
      clusters,
      currentAssociationAvailable: currentTopology.ok,
      referenceCountsComplete: topologyResults.every((result) => result.ok),
      warnings,
      source: warnings.length ? "mixed" : "live",
    };
  }

  async function loadStorageEngineDetail(routeId, storageClusterId, componentType, storageClusterType, engineName) {
    const list = await loadStorageEngineClusters(routeId, componentType, storageClusterType, engineName);
    const cluster = list.clusters.find((item) => item.id === String(storageClusterId) || item.name === storageClusterId);
    if (!cluster) throw new Error(`${engineName} cluster ${storageClusterId} was not returned by the API`);
    const numericClusterId = numberId(cluster.id);
    if (!numericClusterId) throw new Error(`${engineName} cluster response does not contain a numeric id`);
    const [topicsResult, groupsResult] = await Promise.all([
      settled(() => fetchTopics(numericClusterId, cluster.clusterType)),
      settled(() => fetchGroups(numericClusterId, cluster.clusterType)),
    ]);
    const warnings = [
      ...list.warnings,
      ...(topicsResult.ok ? [] : [`${cluster.name} Topic：${topicsResult.error}`]),
      ...(groupsResult.ok ? [] : [`${cluster.name} 消费组：${groupsResult.error}`]),
    ];
    return {
      data: {
        cluster,
        topics: topicsResult.ok ? topicsResult.data.map(mapKafkaTopic) : [],
        groups: groupsResult.ok ? groupsResult.data.map(mapKafkaGroup) : [],
        topicsAvailable: topicsResult.ok,
        groupsAvailable: groupsResult.ok,
      },
      meta: { source: warnings.length ? "mixed" : "live", warnings, fetchedAt: new Date().toISOString() },
    };
  }

  return {
    async getKafkaClusterList(routeId) {
      const result = await loadStorageEngineClusters(routeId, "kafka", "STORAGE_KAFKA_CLUSTER", "Kafka");
      return {
        data: {
          clusters: result.clusters,
          currentAssociationAvailable: result.currentAssociationAvailable,
          referenceCountsComplete: result.referenceCountsComplete,
        },
        meta: { source: result.source, warnings: result.warnings, fetchedAt: new Date().toISOString() },
      };
    },

    async getKafkaClusterDetail(routeId, kafkaClusterId) {
      return loadStorageEngineDetail(routeId, kafkaClusterId, "kafka", "STORAGE_KAFKA_CLUSTER", "Kafka");
    },

    async getRocketMqClusterList(routeId) {
      const result = await loadStorageEngineClusters(routeId, "rocketmq", "STORAGE_ROCKETMQ_CLUSTER", "RocketMQ");
      return {
        data: {
          clusters: result.clusters,
          currentAssociationAvailable: result.currentAssociationAvailable,
          referenceCountsComplete: result.referenceCountsComplete,
        },
        meta: { source: result.source, warnings: result.warnings, fetchedAt: new Date().toISOString() },
      };
    },

    async getRocketMqClusterDetail(routeId, rocketMqClusterId) {
      return loadStorageEngineDetail(routeId, rocketMqClusterId, "rocketmq", "STORAGE_ROCKETMQ_CLUSTER", "RocketMQ");
    },

    async getStorageRelationshipList(routeId) {
      const engineResults = await Promise.all([
        settled(() => loadStorageEngineClusters(routeId, "kafka", "STORAGE_KAFKA_CLUSTER", "Kafka")),
        settled(() => loadStorageEngineClusters(routeId, "rocketmq", "STORAGE_ROCKETMQ_CLUSTER", "RocketMQ")),
      ]);
      const successfulResults = engineResults.filter((result) => result.ok);
      if (!successfulResults.length) {
        throw new Error(engineResults.map((result) => result.error).filter(Boolean).join("；") || "存储集群关联查询失败");
      }
      const clusters = successfulResults.flatMap((result) => result.data.clusters);
      const relationships = clusters.flatMap((component) => component.relatedEventMeshes.map((eventMesh) => ({
        id: `${component.type}-${component.id}-${eventMesh.id}`,
        component: {
          id: component.id,
          name: component.name,
          description: component.description,
          type: component.type,
          clusterType: component.clusterType,
          region: component.region,
          version: component.version,
          deployStatus: component.deployStatus,
          nodes: component.nodes,
          nodesAvailable: component.nodesAvailable,
        },
        eventMesh,
        current: String(eventMesh.routeId) === String(routeId) || String(eventMesh.id) === String(routeId),
        createTime: null,
      })));
      const warnings = [
        ...engineResults.flatMap((result, index) => result.ok ? result.data.warnings : [`${index === 0 ? "Kafka" : "RocketMQ"}：${result.error}`]),
      ];
      return {
        data: { relationships },
        meta: { source: warnings.length ? "mixed" : "live", warnings, fetchedAt: new Date().toISOString() },
      };
    },

    async getEventMeshRuntimes(routeId) {
      const response = await client.post(dashboardEndpoints.homepageClusters, {
        organizationId: organizationId(),
        clusterType: "EVENTMESH_JVM_CLUSTER",
      });
      const entities = parseArray(clusterEntitySchema, response.data, "homepage cluster list");
      const entity = entities.find((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
      if (!entity) throw new Error(`cluster ${routeId} was not returned by the API`);
      const clusterId = numberId(entity.id ?? entity.clusterId);
      if (!clusterId) throw new Error("cluster response does not contain a numeric id");
      const runtimes = await fetchRuntimes(clusterId, entity.clusterType ?? apiConfig.clusterType);
      const config = clusterConfig(entity);
      return {
        data: {
          cluster: {
            id: String(clusterId),
            routeId: String(routeId),
            name: entity.name ?? String(routeId),
            description: entity.description ?? "—",
            clusterType: entity.clusterType ?? apiConfig.clusterType,
            deployStatus: entity.deployStatusType ?? null,
            region: config.region ?? "—",
            version: entity.version ?? "—",
            raw: entity,
          },
          runtimes: runtimes.map(mapRuntime),
        },
        meta: { source: "live", warnings: [], fetchedAt: new Date().toISOString() },
      };
    },

    async getHomepageClusters() {
      const response = await client.post(dashboardEndpoints.homepageClusters, {
        organizationId: organizationId(),
        clusterType: "EVENTMESH_JVM_CLUSTER",
      });
      const entities = parseArray(clusterEntitySchema, response.data, "homepage cluster list");
      return Promise.all(entities.map(async (entity) => {
        const clusterId = numberId(entity.id ?? entity.clusterId);
        if (!clusterId) return { ...entity, homepageRuntimeCount: null, homepageMetaNodeCount: null, homepageNodeWarnings: ["cluster response does not contain a numeric id"] };
        const clusterType = entity.clusterType ?? apiConfig.clusterType;
        const [runtimesResult, topologyResult] = await Promise.all([
          settled(() => fetchRuntimes(clusterId, clusterType)),
          settled(() => fetchTopology(clusterId, clusterType)),
        ]);
        const metaNodeCount = topologyResult.ok ? countMetaNodes(topologyResult.data) : null;
        return {
          ...entity,
          homepageRuntimeCount: runtimesResult.ok ? runtimesResult.data.length : null,
          homepageMetaNodeCount: metaNodeCount,
          homepageNodeWarnings: [
            ...(runtimesResult.ok ? [] : [`Runtime: ${runtimesResult.error}`]),
            ...(topologyResult.ok ? [] : [`Meta: ${topologyResult.error}`]),
            ...(topologyResult.ok && metaNodeCount == null ? ["Meta: topology did not return a node list"] : []),
          ],
        };
      }));
    },

    async getClusterLandscape(routeId) {
      const response = await client.post(dashboardEndpoints.homepageClusters, {
        organizationId: organizationId(),
        clusterType: "EVENTMESH_JVM_CLUSTER",
      });
      const entities = parseArray(clusterEntitySchema, response.data, "homepage cluster list");
      const entity = entities.find((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
      if (!entity) throw new Error(`cluster ${routeId} was not returned by the API`);

      const clusterId = numberId(entity.id ?? entity.clusterId);
      if (!clusterId) throw new Error("cluster response does not contain a numeric id");
      const clusterType = entity.clusterType ?? apiConfig.clusterType;
      const [runtimesResult, topologyResult] = await Promise.all([
        settled(() => fetchRuntimes(clusterId, clusterType)),
        settled(() => fetchTopology(clusterId, clusterType)),
      ]);
      const config = clusterConfig(entity);
      const warnings = [
        ...(runtimesResult.ok ? [] : [`Runtime：${runtimesResult.error}`]),
        ...(topologyResult.ok ? [] : [`关联集群：${topologyResult.error}`]),
      ];

      return {
        data: {
          cluster: {
            id: String(entity.id ?? entity.clusterId),
            routeId: String(routeId),
            name: entity.name ?? String(routeId),
            description: entity.description ?? "—",
            clusterType,
            deployStatus: entity.deployStatusType ?? null,
            region: config.region ?? "—",
            version: entity.version ?? "—",
            raw: entity,
          },
          runtimes: runtimesResult.ok ? runtimesResult.data.map(mapLandscapeNode) : [],
          components: topologyResult.ok ? topologyResult.data.map(mapLandscapeComponent) : [],
          runtimesAvailable: runtimesResult.ok,
          topologyAvailable: topologyResult.ok,
        },
        meta: {
          source: warnings.length ? "mixed" : "live",
          warnings,
          fetchedAt: new Date().toISOString(),
        },
      };
    },

    async getMetaOverview(routeId) {
      const response = await client.post(dashboardEndpoints.homepageClusters, {
        organizationId: organizationId(),
        clusterType: "EVENTMESH_JVM_CLUSTER",
      });
      const entities = parseArray(clusterEntitySchema, response.data, "homepage cluster list");
      const currentIndex = entities.findIndex((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
      if (currentIndex < 0) throw new Error(`cluster ${routeId} was not returned by the API`);

      const topologyResults = await Promise.all(entities.map((entity) => {
        const clusterId = numberId(entity.id ?? entity.clusterId);
        if (!clusterId) return Promise.resolve({ ok: false, error: `cluster ${entity.name ?? "unknown"} does not contain a numeric id` });
        return settled(() => fetchTopology(clusterId, entity.clusterType ?? apiConfig.clusterType));
      }));
      const currentTopology = topologyResults[currentIndex];
      if (!currentTopology.ok) throw new Error(`Meta 关联树查询失败：${currentTopology.error}`);

      const metaByEventMesh = topologyResults.map((result) => result.ok
        ? result.data.map(mapLandscapeComponent).filter((item) => item.type === "meta")
        : []);
      const referenceCounts = new Map();
      metaByEventMesh.flat().forEach((item) => referenceCounts.set(item.id, (referenceCounts.get(item.id) ?? 0) + 1));
      const components = metaByEventMesh[currentIndex].map((item) => ({
        ...item,
        referenceCount: referenceCounts.get(item.id) ?? 1,
      }));
      const warnings = topologyResults.flatMap((result, index) => result.ok ? [] : [
        `${entities[index]?.name ?? `EventMesh #${index + 1}`}：${result.error}`,
      ]);
      const currentEntity = entities[currentIndex];
      const config = clusterConfig(currentEntity);

      return {
        data: {
          cluster: {
            id: String(currentEntity.id ?? currentEntity.clusterId),
            routeId: String(routeId),
            name: currentEntity.name ?? String(routeId),
            description: currentEntity.description ?? "—",
            region: config.region ?? "—",
          },
          components,
          relationCount: metaByEventMesh.flat().length,
          eventMeshClusterCount: entities.length,
          queriedEventMeshClusterCount: topologyResults.filter((result) => result.ok).length,
          nodesAvailable: components.every((item) => item.nodesAvailable),
        },
        meta: {
          source: warnings.length ? "mixed" : "live",
          warnings,
          fetchedAt: new Date().toISOString(),
        },
      };
    },

    async getMetaClusterList(routeId) {
      const [eventMeshResponse, ...metaClusterResults] = await Promise.all([
        client.post(dashboardEndpoints.homepageClusters, {
          organizationId: organizationId(),
          clusterType: "EVENTMESH_JVM_CLUSTER",
        }),
        ...META_CLUSTER_TYPES.map((clusterType) => settled(async () => {
          const response = await client.post(dashboardEndpoints.clusters, {
            organizationId: organizationId(),
            clusterType,
          });
          return parseArray(clusterEntitySchema, response.data, `${clusterType} cluster list`);
        })),
      ]);
      const eventMeshEntities = parseArray(clusterEntitySchema, eventMeshResponse.data, "homepage cluster list");
      const currentIndex = eventMeshEntities.findIndex((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
      if (currentIndex < 0) throw new Error(`cluster ${routeId} was not returned by the API`);

      const successfulMetaQueries = metaClusterResults.filter((result) => result.ok);
      if (!successfulMetaQueries.length) {
        throw new Error(metaClusterResults.map((result) => result.error).filter(Boolean).join("; ") || "Meta cluster APIs are unavailable");
      }
      const metaEntityMap = new Map();
      successfulMetaQueries.flatMap((result) => result.data).forEach((entity) => {
        const key = String(entity.id ?? entity.clusterId ?? `${entity.clusterType}:${entity.name}`);
        if (!metaEntityMap.has(key)) metaEntityMap.set(key, entity);
      });
      const metaEntities = [...metaEntityMap.values()];

      const [topologyResults, nodeResults] = await Promise.all([
        Promise.all(eventMeshEntities.map((entity) => {
          const clusterId = numberId(entity.id ?? entity.clusterId);
          if (!clusterId) return Promise.resolve({ ok: false, error: `cluster ${entity.name ?? "unknown"} does not contain a numeric id` });
          return settled(() => fetchTopology(clusterId, entity.clusterType ?? apiConfig.clusterType));
        })),
        Promise.all(metaEntities.map((entity) => {
          const clusterId = numberId(entity.id ?? entity.clusterId);
          if (!clusterId) return Promise.resolve({ ok: false, error: `Meta cluster ${entity.name ?? "unknown"} does not contain a numeric id` });
          return settled(() => fetchRuntimes(clusterId, entity.clusterType ?? "EVENTMESH_JVM_META"));
        })),
      ]);

      const metaByEventMesh = topologyResults.map((result) => result.ok
        ? result.data.map(mapLandscapeComponent).filter((item) => item.type === "meta")
        : []);
      const referenceCounts = new Map();
      metaByEventMesh.flat().forEach((item) => referenceCounts.set(item.id, (referenceCounts.get(item.id) ?? 0) + 1));
      const currentTopology = topologyResults[currentIndex];
      const currentMetaIds = new Set(currentTopology.ok ? metaByEventMesh[currentIndex].map((item) => item.id) : []);
      const clusters = metaEntities.map((entity, index) => {
        const nodeResult = nodeResults[index];
        const component = mapLandscapeComponent({
          ...entity,
          children: nodeResult.ok && "data" in nodeResult ? nodeResult.data : undefined,
        }, index);
        const relatedEventMeshes = eventMeshEntities.flatMap((eventMesh, eventMeshIndex) => {
          if (!metaByEventMesh[eventMeshIndex]?.some((item) => item.id === component.id)) return [];
          const config = clusterConfig(eventMesh);
          return [{
            id: String(eventMesh.id ?? eventMesh.clusterId ?? eventMesh.name),
            routeId: String(eventMesh.name ?? eventMesh.id ?? eventMesh.clusterId),
            name: eventMesh.name ?? `EventMesh #${eventMesh.id ?? eventMesh.clusterId}`,
            description: eventMesh.description ?? "—",
            region: config.region ?? "—",
            deployStatus: eventMesh.deployStatusType ?? null,
          }];
        });
        return {
          ...component,
          referenceCount: referenceCounts.get(component.id) ?? 0,
          currentAssociated: currentTopology.ok ? currentMetaIds.has(component.id) : null,
          relatedEventMeshes,
        };
      });
      const warnings = [
        ...metaClusterResults.flatMap((result, index) => result.ok ? [] : [`${META_CLUSTER_TYPES[index]}：${result.error}`]),
        ...topologyResults.flatMap((result, index) => result.ok ? [] : [`${eventMeshEntities[index]?.name ?? `EventMesh #${index + 1}`} 关联树：${result.error}`]),
        ...nodeResults.flatMap((result, index) => result.ok ? [] : [`${metaEntities[index]?.name ?? `Meta #${index + 1}`} 节点：${result.error}`]),
      ];

      return {
        data: {
          clusters,
          currentAssociationAvailable: currentTopology.ok,
          referenceCountsComplete: topologyResults.every((result) => result.ok),
        },
        meta: {
          source: warnings.length ? "mixed" : "live",
          warnings,
          fetchedAt: new Date().toISOString(),
        },
      };
    },

    async getStorageOverview(routeId) {
      const [eventMeshResponse, ...inventoryResults] = await Promise.all([
        client.post(dashboardEndpoints.homepageClusters, {
          organizationId: organizationId(),
          clusterType: "EVENTMESH_JVM_CLUSTER",
        }),
        ...STORAGE_CLUSTER_TYPES.map((clusterType) => settled(async () => {
          const response = await client.post(dashboardEndpoints.clusters, {
            organizationId: organizationId(),
            clusterType,
          });
          return parseArray(clusterEntitySchema, response.data, `${clusterType} cluster list`);
        })),
      ]);
      const eventMeshEntities = parseArray(clusterEntitySchema, eventMeshResponse.data, "homepage cluster list");
      const currentIndex = eventMeshEntities.findIndex((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
      if (currentIndex < 0) throw new Error(`cluster ${routeId} was not returned by the API`);

      const topologyResults = await Promise.all(eventMeshEntities.map((entity) => {
        const clusterId = numberId(entity.id ?? entity.clusterId);
        if (!clusterId) return Promise.resolve({ ok: false, error: `cluster ${entity.name ?? "unknown"} does not contain a numeric id` });
        return settled(() => fetchTopology(clusterId, entity.clusterType ?? apiConfig.clusterType));
      }));
      const currentTopology = topologyResults[currentIndex];
      if (!currentTopology.ok) throw new Error(`存储集群关联树查询失败：${currentTopology.error}`);

      const storageByEventMesh = topologyResults.map((result) => result.ok
        ? result.data.map(mapLandscapeComponent).filter((item) => item.type === "kafka" || item.type === "rocketmq")
        : []);
      const referenceCounts = new Map();
      storageByEventMesh.flat().forEach((item) => referenceCounts.set(item.id, (referenceCounts.get(item.id) ?? 0) + 1));
      const inventoryMap = new Map();
      inventoryResults.filter((result) => result.ok).flatMap((result) => result.data).forEach((entity) => {
        const key = String(entity.id ?? entity.clusterId ?? `${entity.clusterType}:${entity.name}`);
        if (!inventoryMap.has(key)) inventoryMap.set(key, entity);
      });
      const currentStorage = storageByEventMesh[currentIndex];
      const nodeResults = await Promise.all(currentStorage.map((component) => {
        const clusterId = numberId(component.id);
        if (!clusterId) return Promise.resolve({ ok: false, error: `storage cluster ${component.name} does not contain a numeric id` });
        return settled(() => fetchRuntimes(clusterId, component.clusterType));
      }));
      const components = currentStorage.map((component, index) => {
        const inventory = inventoryMap.get(component.id);
        const nodeResult = nodeResults[index];
        const raw = { ...component.raw, ...(inventory ?? {}) };
        if (nodeResult.ok) {
          raw.children = nodeResult.data;
          raw.runtime = undefined;
        }
        const mapped = mapLandscapeComponent(raw, index);
        return {
          ...mapped,
          nodesAvailable: nodeResult.ok || component.nodesAvailable,
          nodes: nodeResult.ok ? mapped.nodes : component.nodes,
          referenceCount: referenceCounts.get(component.id) ?? 1,
        };
      });
      const warnings = [
        ...inventoryResults.flatMap((result, index) => result.ok ? [] : [`${STORAGE_CLUSTER_TYPES[index]}：${result.error}`]),
        ...topologyResults.flatMap((result, index) => result.ok ? [] : [`${eventMeshEntities[index]?.name ?? `EventMesh #${index + 1}`} 关联树：${result.error}`]),
        ...nodeResults.flatMap((result, index) => result.ok || currentStorage[index]?.nodesAvailable ? [] : [`${currentStorage[index]?.name ?? `存储集群 #${index + 1}`} Broker：${result.error}`]),
      ];
      const currentEntity = eventMeshEntities[currentIndex];
      const config = clusterConfig(currentEntity);

      return {
        data: {
          cluster: {
            id: String(currentEntity.id ?? currentEntity.clusterId),
            routeId: String(routeId),
            name: currentEntity.name ?? String(routeId),
            description: currentEntity.description ?? "—",
            region: config.region ?? "—",
          },
          components,
          inventoryCount: inventoryResults.some((result) => result.ok) ? inventoryMap.size : null,
          relationCount: storageByEventMesh.flat().length,
          eventMeshClusterCount: eventMeshEntities.length,
          queriedEventMeshClusterCount: topologyResults.filter((result) => result.ok).length,
          nodesAvailable: components.every((item) => item.nodesAvailable),
        },
        meta: {
          source: warnings.length ? "mixed" : "live",
          warnings,
          fetchedAt: new Date().toISOString(),
        },
      };
    },

    async getTopicOverview(routeId) {
      const response = await client.post(dashboardEndpoints.homepageClusters, {
        organizationId: organizationId(),
        clusterType: "EVENTMESH_JVM_CLUSTER",
      });
      const entities = parseArray(clusterEntitySchema, response.data, "homepage cluster list");
      const entity = entities.find((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
      if (!entity) throw new Error(`cluster ${routeId} was not returned by the API`);
      const clusterId = numberId(entity.id ?? entity.clusterId);
      if (!clusterId) throw new Error("cluster response does not contain a numeric id");
      const rawTopics = await fetchTopics(clusterId, entity.clusterType ?? apiConfig.clusterType);
      const topics = rawTopics.map(mapKafkaTopic);
      const knownQueueCount = topics.filter((topic) => Number.isFinite(topic.partitions));
      return {
        data: {
          cluster: {
            id: String(entity.id ?? entity.clusterId),
            routeId: String(routeId),
            name: entity.name ?? String(routeId),
          },
          topics,
          queueCount: knownQueueCount.reduce((sum, topic) => sum + topic.partitions, 0),
          queueCountComplete: knownQueueCount.length === topics.length,
        },
        meta: { source: "live", warnings: [], fetchedAt: new Date().toISOString() },
      };
    },

    async getConsumerGroups(routeId) {
      const response = await client.post(dashboardEndpoints.homepageClusters, {
        organizationId: organizationId(),
        clusterType: "EVENTMESH_JVM_CLUSTER",
      });
      const entities = parseArray(clusterEntitySchema, response.data, "homepage cluster list");
      const entity = entities.find((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
      if (!entity) throw new Error(`cluster ${routeId} was not returned by the API`);
      const clusterId = numberId(entity.id ?? entity.clusterId);
      if (!clusterId) throw new Error("cluster response does not contain a numeric id");
      const clusterType = entity.clusterType ?? apiConfig.clusterType;
      const [rawGroups, rawTopics] = await Promise.all([
        fetchGroups(clusterId, clusterType),
        fetchTopics(clusterId, clusterType),
      ]);
      const consumers = rawGroups.map(mapKafkaGroup).filter((group) => Number(group.type) === 0);
      const topics = rawTopics.map(mapKafkaTopic);
      const topicGroupResults = await Promise.all(rawTopics.map((topic) => settled(async () => {
        const topicId = numberId(topic?.id ?? topic?.topicId);
        if (!topicId) throw new Error(`${topic?.topicName ?? "Topic"} 缺少 ID`);
        const topicGroupsResponse = await client.post(dashboardEndpoints.groupsByTopic, { id: topicId });
        return parseArray(passthroughItemSchema, topicGroupsResponse.data, "topic consumer groups");
      })));
      const topicNamesByGroup = new Map();
      topicGroupResults.forEach((result, index) => {
        if (!result.ok) return;
        result.data.filter((group) => Number(group?.type) === 0).forEach((group) => {
          const keys = [group?.id, group?.groupId, group?.name, group?.groupName].filter((value) => value != null).map(String);
          keys.forEach((key) => topicNamesByGroup.set(key, [...new Set([...(topicNamesByGroup.get(key) ?? []), topics[index].name])]));
        });
      });
      const warnings = topicGroupResults.flatMap((result, index) => result.ok ? [] : [`${topics[index]?.name ?? `Topic #${index + 1}`}：${result.error}`]);
      return {
        data: {
          cluster: { id: String(clusterId), routeId: String(routeId), name: entity.name ?? String(routeId) },
          groups: consumers.map((group) => ({
            ...group,
            databaseStatus: group.raw?.status ?? null,
            createTime: group.raw?.createTime ?? group.createTime,
            topics: topicNamesByGroup.get(group.id) ?? topicNamesByGroup.get(group.name) ?? [],
            topicsAvailable: warnings.length === 0,
          })),
        },
        meta: { source: warnings.length ? "mixed" : "live", warnings, fetchedAt: new Date().toISOString() },
      };
    },

    async getOperationHistory(routeId) {
      const response = await client.post(dashboardEndpoints.homepageClusters, {
        organizationId: organizationId(),
        clusterType: "EVENTMESH_JVM_CLUSTER",
      });
      const entities = parseArray(clusterEntitySchema, response.data, "homepage cluster list");
      const entity = entities.find((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
      if (!entity) throw new Error(`cluster ${routeId} was not returned by the API`);
      const clusterId = numberId(entity.id ?? entity.clusterId);
      if (!clusterId) throw new Error("cluster response does not contain a numeric id");
      const rawOperations = await fetchOperations(clusterId);
      const operations = rawOperations.map((operation, index) => ({
        id: String(operation?.id ?? `operation-${index + 1}`),
        clusterId: String(operation?.clusterId ?? clusterId),
        operationType: operation?.operationType ?? "—",
        targetType: operation?.targetType ?? "—",
        state: operation?.state ?? null,
        content: operation?.content ?? "—",
        createTime: operation?.createTime ?? null,
        endTime: operation?.endTime ?? null,
        operationUser: operation?.operationUser ?? "—",
        result: operation?.result ?? "—",
      })).sort((left, right) => String(right.createTime ?? "").localeCompare(String(left.createTime ?? "")));
      return {
        data: {
          cluster: { id: String(clusterId), routeId: String(routeId), name: entity.name ?? String(routeId) },
          operations,
        },
        meta: { source: "live", warnings: [], fetchedAt: new Date().toISOString() },
      };
    },

    async getEventMeshOverview(routeId) {
      const response = await client.post(dashboardEndpoints.homepageClusters, {
        organizationId: organizationId(),
        clusterType: "EVENTMESH_JVM_CLUSTER",
      });
      const entities = parseArray(clusterEntitySchema, response.data, "homepage cluster list");
      const entity = entities.find((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
      if (!entity) throw new Error(`cluster ${routeId} was not returned by the API`);

      const clusterId = numberId(entity.id ?? entity.clusterId);
      if (!clusterId) throw new Error("cluster response does not contain a numeric id");
      const clusterType = entity.clusterType ?? apiConfig.clusterType;
      const [runtimesResult, topologyResult, topicsResult, groupsResult] = await Promise.all([
        settled(() => fetchRuntimes(clusterId, clusterType)),
        settled(() => fetchTopology(clusterId, clusterType)),
        settled(() => fetchTopics(clusterId, clusterType)),
        settled(() => fetchGroups(clusterId, clusterType)),
      ]);
      const config = clusterConfig(entity);
      const warnings = [
        ...(runtimesResult.ok ? [] : [`Runtime：${runtimesResult.error}`]),
        ...(topologyResult.ok ? [] : [`关联集群：${topologyResult.error}`]),
        ...(topicsResult.ok ? [] : [`Topic：${topicsResult.error}`]),
        ...(groupsResult.ok ? [] : [`消费者：${groupsResult.error}`]),
      ];

      return {
        data: {
          cluster: {
            id: String(entity.id ?? entity.clusterId),
            routeId: String(routeId),
            name: entity.name ?? String(routeId),
            description: entity.description ?? "—",
            clusterType,
            deployStatus: entity.deployStatusType ?? null,
            trusteeshipType: entity.trusteeshipType ?? null,
            cloudProvider: config.cloudProvider ?? "—",
            kubernetesCluster: config.kubernetesCluster ?? "—",
            infrastructure: config.infrastructure ?? config.infrastructureType ?? "—",
            region: config.region ?? "—",
            version: entity.version ?? "—",
            uptime: uptimeFrom(entity.startTimestamp ?? entity.onlineTimestamp, "—"),
            raw: entity,
          },
          runtimes: runtimesResult.ok ? runtimesResult.data.map(mapLandscapeNode) : [],
          components: topologyResult.ok ? topologyResult.data.map(mapLandscapeComponent) : [],
          topics: topicsResult.ok ? topicsResult.data : [],
          groups: groupsResult.ok ? groupsResult.data : [],
          availability: {
            runtimes: runtimesResult.ok,
            topology: topologyResult.ok,
            topics: topicsResult.ok,
            groups: groupsResult.ok,
          },
        },
        meta: {
          source: warnings.length ? "mixed" : "live",
          warnings,
          fetchedAt: new Date().toISOString(),
        },
      };
    },

    async createCluster(input) {
      const response = await client.post(dashboardEndpoints.createCluster, {
        organizationId: organizationId(),
        clusterId: Number(input.parentClusterId),
        clusterType: input.clusterType || apiConfig.clusterType,
        name: input.name.trim(),
        version: input.version.trim(),
        description: input.description.trim(),
        firstToWhom: input.firstToWhom || "DASHBOARD",
        trusteeshipArrangeType: input.trusteeshipArrangeType || "NOT",
      });
      const id = unwrapPayload(response.data);
      if (id == null || !["number", "string"].includes(typeof id)) throw new Error("Create cluster API did not return a cluster ID");
      return { id: String(id), name: input.name.trim() };
    },

    async getRuntimeById(id) {
      const response = await client.post(dashboardEndpoints.runtimeDetail, { id: Number(id) });
      return parseObject(runtimeEntitySchema, response.data, "runtime detail");
    },

    async getGroupsByTopicId(id) {
      const response = await client.post(dashboardEndpoints.groupsByTopic, { id: Number(id) });
      return parseArray(passthroughItemSchema, response.data, "topic consumer groups");
    },

    async getClusters() {
      const entities = await fetchClusterEntities();
        if (!entities.length) {
          return {
            data: [],
            meta: { source: "live", fallbackReason: null, sources: { clusters: "api", summaries: "api" }, fetchedAt: new Date().toISOString() },
          };
        }
        const [enriched, topologyResults] = await Promise.all([
          Promise.all(entities.map((entity, index) => enrich(entity, index, { includeOperations: false }))),
          Promise.all(entities.map((entity) => settled(() => fetchTopology(numberId(entity.id ?? entity.clusterId), entity.clusterType ?? apiConfig.clusterType)))),
        ]);
        const clusters = enriched.map((item, index) => ({
          ...item.cluster,
          dependencies: topologyResults[index].ok ? topologyResults[index].data.map(mapClusterReference).filter(Boolean) : [],
          dependents: [],
          topologyAvailable: topologyResults[index].ok,
        }));
        const clusterById = new Map(clusters.map((cluster) => [cluster.id, cluster]));
        clusters.forEach((cluster) => cluster.dependencies.forEach((dependency) => {
          const target = clusterById.get(dependency.id);
          if (target && !target.dependents.some((dependent) => dependent.id === cluster.id)) {
            target.dependents.push({ id: cluster.id, name: cluster.name, clusterType: cluster.clusterType, status: cluster.status });
          }
        }));
        const allResults = Object.fromEntries([
          ...enriched.flatMap(({ cluster, results }) => Object.entries(results).map(([key, value]) => [`${cluster.id}.${key}`, value])),
          ...clusters.map((cluster, index) => [`${cluster.id}.topology`, topologyResults[index]]),
        ]);
        return {
          data: clusters,
          meta: { source: sourceFrom(allResults), fallbackReason: fallbackReason(allResults), sources: { clusters: "api", summaries: sourceFrom(allResults), topology: topologyResults.every((result) => result.ok) ? "api" : "unavailable" }, fetchedAt: new Date().toISOString() },
        };
    },

    async getClusterDashboard(routeId, { includeOperations = true } = {}) {
      const entities = await fetchClusterEntities();
        const entity = entities.find((item) => String(item.id ?? item.clusterId) === String(routeId) || item.name === routeId);
        if (!entity) throw new Error(`cluster ${routeId} was not returned by the API`);
        const { cluster, results } = await enrich(entity, Math.max(0, entities.indexOf(entity)), { includeOperations });
        const runtimesData = results.runtimes.ok ? results.runtimes.data.map((runtime, index) => mapRuntime(runtime, index)) : [];
        const topologyResult = await settled(() => fetchTopology(cluster.backendId, cluster.clusterType));
        const dashboardResults = { ...results, topology: topologyResult };
        return {
          data: {
            cluster,
            runtimes: runtimesData,
            topics: results.topics.ok ? results.topics.data : [],
            groups: results.groups.ok ? results.groups.data : [],
            topicCount: results.topics.ok ? results.topics.data.length : cluster.topics,
            groupCount: results.groups.ok ? results.groups.data.length : cluster.groups,
            recentChanges: results.operations.ok ? results.operations.data.map(mapOperation) : [],
            topology: buildClusterTopology(cluster, runtimesData, topologyResult.ok ? topologyResult.data : []),
            topologyError: topologyResult.ok ? null : topologyResult.error,
          },
          meta: {
            source: sourceFrom({ cluster: { ok: true }, ...dashboardResults }),
            fallbackReason: fallbackReason(dashboardResults),
            sources: {
              cluster: "api",
              runtimes: results.runtimes.ok ? "api" : "unavailable",
              topics: results.topics.ok ? "api" : "unavailable",
              groups: results.groups.ok ? "api" : "unavailable",
              throughput: cluster.inbound && cluster.outbound ? "api" : "unavailable",
              changes: results.operations.ok ? "api" : "unavailable",
              topology: topologyResult.ok ? "api" : "unavailable",
            },
            fetchedAt: new Date().toISOString(),
          },
        };
    },
  };
}

export const dashboardRepository: any = createDashboardRepository();
export const clusterListPlaceholder: any = { data: [], meta: { source: "loading", fallbackReason: null, sources: {}, fetchedAt: null } };
export const clusterDetailPlaceholder = (routeId): any => ({
  data: {
    cluster: { id: String(routeId), name: String(routeId), status: "Unknown", score: null, version: "—", clusterId: "—", uptime: "—", created: "—", region: "—" },
    runtimes: [], topics: [], groups: [], topicCount: 0, groupCount: 0, recentChanges: [], topology: null, topologyError: null,
  },
  meta: { source: "loading", fallbackReason: null, sources: {}, fetchedAt: null },
});
