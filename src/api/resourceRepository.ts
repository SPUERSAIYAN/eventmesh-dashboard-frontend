import { apiClient } from "./client.ts";
import { apiConfig } from "./config.ts";
import { unwrapPayload } from "./contracts.ts";

export const resourceEndpoints = Object.freeze({
  clusters: "/user/cluster/queryClusterByOrganizationIdAndType",
  runtimes: "/runtime/queryRuntimeListByClusterId",
  topics: "/user/topic/queryTopicListByClusterId",
  groups: "/user/group/queryGroupListByClusterId",
  operations: "/cluster/log/getList",
  configs: "/user/config/queryByInstanceId",
});

function listPayload(response, label) {
  const data = unwrapPayload(response.data);
  if (data == null) return [];
  if (!Array.isArray(data)) throw new Error(`${label} API did not return a list`);
  return data;
}

function clusterBody(clusterType = apiConfig.clusterType) {
  return { organizationId: apiConfig.organizationId, clusterType };
}

function withCluster(items, cluster) {
  return items.map((item) => ({ ...item, clusterName: cluster.name, clusterId: item.clusterId ?? cluster.id }));
}

function rejectionMessages(results: PromiseSettledResult<any>[]) {
  return results.filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => result.reason?.message || "EventMesh Dashboard API is unavailable");
}

export function createResourceRepository(client = apiClient) {
  async function getClusters() {
    const results = await Promise.allSettled(apiConfig.clusterTypes.map(async (clusterType) => {
      const response = await client.post(resourceEndpoints.clusters, clusterBody(clusterType));
      return listPayload(response, `${clusterType} clusters`);
    }));
    const successful = results.filter((result) => result.status === "fulfilled");
    if (!successful.length) throw results.find((result) => result.status === "rejected")?.reason ?? new Error("Cluster APIs are unavailable");
    const unique = new Map<string, any>();
    successful.flatMap((result) => result.value).forEach((cluster) => {
      const key = String(cluster.id ?? cluster.clusterId ?? `${cluster.clusterType}:${cluster.name}`);
      if (!unique.has(key)) unique.set(key, cluster);
    });
    return [...unique.values()];
  }

  async function getClusterResources(endpoint, label, extra = {}) {
    const clusters = await getClusters();
    const results = await Promise.allSettled(clusters.map(async (cluster) => {
      const response = await client.post(endpoint, {
        clusterId: cluster.id,
        organizationId: apiConfig.organizationId,
        clusterType: cluster.clusterType ?? apiConfig.clusterType,
        ...extra,
      });
      return withCluster(listPayload(response, label), cluster);
    }));
    const successful = results.filter((result) => result.status === "fulfilled");
    if (clusters.length && !successful.length) throw (results[0] as PromiseRejectedResult).reason;
    return { clusters, data: successful.flatMap((result) => result.value), warnings: rejectionMessages(results) };
  }

  return {
    getClusters,

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

    async getOperations() {
      return getClusterResources(resourceEndpoints.operations, "Operations");
    },

    async getOverview({ includeOperations = true } = {}) {
      const clusters = await getClusters();
      const [resourceResults, operationResults] = await Promise.all([
        Promise.allSettled(clusters.map(async (cluster) => {
          const body = { clusterId: cluster.id, organizationId: apiConfig.organizationId, clusterType: cluster.clusterType ?? apiConfig.clusterType };
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
        includeOperations ? Promise.allSettled(clusters.map((cluster) => client.post(resourceEndpoints.operations, { clusterId: cluster.id }).then((response) => withCluster(listPayload(response, "Operations"), cluster)))) : Promise.resolve([]),
      ]);
      return {
        clusters,
        resources: resourceResults.filter((result) => result.status === "fulfilled").map((result) => result.value),
        operations: operationResults.filter((result) => result.status === "fulfilled").flatMap((result) => result.value),
        warnings: [...rejectionMessages(resourceResults), ...rejectionMessages(operationResults)],
      };
    },
  };
}

export const resourceRepository: any = createResourceRepository();
