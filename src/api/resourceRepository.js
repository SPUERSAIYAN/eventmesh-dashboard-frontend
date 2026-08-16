import { apiClient } from "./client.js";
import { apiConfig } from "./config.js";
import { activeOrganizationId } from "./session.js";
import { unwrapPayload } from "./contracts.js";

export const resourceEndpoints = Object.freeze({
  clusters: "/user/cluster/queryClusterByOrganizationIdAndType",
  runtimes: "/runtime/queryRuntimeListByClusterId",
  topics: "/user/topic/queryTopicListByClusterId",
  groups: "/user/group/queryGroupListByClusterId",
  connections: "/netConnection",
  operations: "/cluster/log/getList",
  createTopic: "/user/topic/createTopic",
  deleteGroup: "/user/group/deleteGroupById",
  healthHistory: "/cluster/health/getHistoryLiveStatus",
  configs: "/user/config/queryByInstanceId",
});

function listPayload(response, label) {
  const data = unwrapPayload(response.data);
  if (data == null) return [];
  if (!Array.isArray(data)) throw new Error(`${label} API did not return a list`);
  return data;
}

function clusterBody(clusterType = apiConfig.clusterType) {
  return { organizationId: activeOrganizationId() ?? apiConfig.organizationId, clusterType };
}

function withCluster(items, cluster) {
  return items.map((item) => ({ ...item, clusterName: cluster.name, clusterId: item.clusterId ?? cluster.id }));
}

function sortNewestFirst(items) {
  const timestamp = (item) => new Date(item.finishTime ?? item.beginTime ?? item.createTime ?? 0).getTime() || 0;
  return [...items].sort((left, right) => timestamp(right) - timestamp(left));
}

export function createResourceRepository(client = apiClient) {
  async function getClusters() {
    const results = await Promise.allSettled(apiConfig.clusterTypes.map(async (clusterType) => {
      const response = await client.post(resourceEndpoints.clusters, clusterBody(clusterType));
      return listPayload(response, `${clusterType} clusters`);
    }));
    const successful = results.filter((result) => result.status === "fulfilled");
    if (!successful.length) throw results.find((result) => result.status === "rejected")?.reason ?? new Error("Cluster APIs are unavailable");
    const unique = new Map();
    successful.flatMap((result) => result.value).forEach((cluster) => {
      const key = String(cluster.id ?? cluster.clusterId ?? `${cluster.clusterType}:${cluster.name}`);
      if (!unique.has(key)) unique.set(key, cluster);
    });
    return [...unique.values()];
  }

  async function getClusterResources(endpoint, label, extra = {}) {
    const clusters = await getClusters();
    const lists = await Promise.all(clusters.map(async (cluster) => {
      const response = await client.post(endpoint, {
        clusterId: cluster.id,
        organizationId: activeOrganizationId() ?? apiConfig.organizationId,
        clusterType: cluster.clusterType ?? apiConfig.clusterType,
        ...extra,
      });
      return withCluster(listPayload(response, label), cluster);
    }));
    return { clusters, data: lists.flat() };
  }

  return {
    getClusters,

    async createTopic(input) {
      const response = await client.post(resourceEndpoints.createTopic, {
        organizationId: activeOrganizationId() ?? apiConfig.organizationId,
        clusterId: Number(input.clusterId),
        clusterType: input.clusterType ?? apiConfig.clusterType,
        rangeType: "TOPIC",
        operationRangeType: "CLUSTER",
        operationRangeId: Number(input.clusterId),
        operationDataTypeId: null,
        operationDataId: null,
        name: input.name.trim(),
        description: input.description.trim(),
        partitionsNums: Number(input.partitionsNums),
        replicasNums: Number(input.replicasNums),
        saveTime: Number(input.saveTime),
        cleanupStrategy: Number(input.cleanupStrategy),
      });
      return unwrapPayload(response.data);
    },

    async deleteGroup(id) {
      const response = await client.post(resourceEndpoints.deleteGroup, { id: Number(id) });
      return unwrapPayload(response.data);
    },

    async getHealthHistory({ type, instanceId, hours = 24 }) {
      const start = new Date(Date.now() - hours * 3_600_000);
      const startTime = start.toISOString().slice(0, 19);
      const response = await client.get(resourceEndpoints.healthHistory, { params: { type, instanceId, startTime } });
      return sortNewestFirst(listPayload(response, "Health history"));
    },

    async getConfigs({ instanceId, instanceType = "CLUSTER", configName = null }) {
      const response = await client.post(resourceEndpoints.configs, { instanceId: Number(instanceId), instanceType, configName });
      return listPayload(response, "Configuration");
    },

    async getTopics() {
      return getClusterResources(resourceEndpoints.topics, "Topics", { topicName: null });
    },

    async getGroups() {
      return getClusterResources(resourceEndpoints.groups, "Consumer groups");
    },

    async getConnections() {
      return getClusterResources(resourceEndpoints.connections, "Connections");
    },

    async getOperations() {
      return getClusterResources(resourceEndpoints.operations, "Operations");
    },

    async getOverview({ includeOperations = true } = {}) {
      const clusters = await getClusters();
      const [resources, connectionLists, operationLists] = await Promise.all([
        Promise.all(clusters.map(async (cluster) => {
          const body = { clusterId: cluster.id, organizationId: activeOrganizationId() ?? apiConfig.organizationId, clusterType: cluster.clusterType ?? apiConfig.clusterType };
          const [runtimes, topics, groups] = await Promise.all([
            client.post(resourceEndpoints.runtimes, body),
            client.post(resourceEndpoints.topics, { ...body, topicName: null }),
            client.post(resourceEndpoints.groups, body),
          ]);
          return {
            cluster,
            runtimes: listPayload(runtimes, "Runtimes").length,
            topics: listPayload(topics, "Topics").length,
            groups: listPayload(groups, "Consumer groups").length,
          };
        })),
        Promise.all(clusters.map((cluster) => client.post(resourceEndpoints.connections, { clusterId: cluster.id }).then((response) => withCluster(listPayload(response, "Connections"), cluster)))),
        includeOperations ? Promise.all(clusters.map((cluster) => client.post(resourceEndpoints.operations, { clusterId: cluster.id }).then((response) => withCluster(listPayload(response, "Operations"), cluster)))) : Promise.resolve([]),
      ]);
      return {
        clusters,
        resources,
        connections: connectionLists.flat(),
        operations: operationLists.flat(),
      };
    },
  };
}

export const resourceRepository = createResourceRepository();
