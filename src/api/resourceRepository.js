import { apiClient } from "./client.js";
import { apiConfig } from "./config.js";
import { unwrapPayload } from "./contracts.js";

export const resourceEndpoints = Object.freeze({
  clusters: "/user/cluster/queryClusterByOrganizationIdAndType",
  runtimes: "/runtime/queryRuntimeListByClusterId",
  topics: "/user/topic/queryTopicListByClusterId",
  groups: "/user/group/queryGroupListByClusterId",
  connections: "/netConnection",
  operations: "/cluster/log/getList",
});

function listPayload(response, label) {
  const data = unwrapPayload(response.data);
  if (!Array.isArray(data)) throw new Error(`${label} API did not return a list`);
  return data;
}

function clusterBody() {
  return { organizationId: apiConfig.organizationId, clusterType: apiConfig.clusterType };
}

function withCluster(items, cluster) {
  return items.map((item) => ({ ...item, clusterName: cluster.name, clusterId: item.clusterId ?? cluster.id }));
}

export function createResourceRepository(client = apiClient) {
  async function getClusters() {
    const response = await client.post(resourceEndpoints.clusters, clusterBody());
    return listPayload(response, "Clusters");
  }

  async function getClusterResources(endpoint, label, extra = {}) {
    const clusters = await getClusters();
    const lists = await Promise.all(clusters.map(async (cluster) => {
      const response = await client.post(endpoint, {
        clusterId: cluster.id,
        organizationId: apiConfig.organizationId,
        clusterType: apiConfig.clusterType,
        ...extra,
      });
      return withCluster(listPayload(response, label), cluster);
    }));
    return { clusters, data: lists.flat() };
  }

  return {
    getClusters,

    async getTopics() {
      return getClusterResources(resourceEndpoints.topics, "Topics", { topicName: null });
    },

    async getGroups() {
      return getClusterResources(resourceEndpoints.groups, "Consumer groups");
    },

    async getConnections() {
      const [clusters, response] = await Promise.all([
        getClusters(),
        client.post(resourceEndpoints.connections, {}),
      ]);
      const names = new Map(clusters.map((cluster) => [String(cluster.id), cluster.name]));
      const data = listPayload(response, "Connections").map((item) => ({
        ...item,
        clusterName: names.get(String(item.clusterId)) ?? `Cluster #${item.clusterId}`,
      }));
      return { clusters, data };
    },

    async getOperations(clusterId = null) {
      const [clusters, response] = await Promise.all([
        getClusters(),
        client.post(resourceEndpoints.operations, clusterId ? { clusterId } : {}),
      ]);
      const names = new Map(clusters.map((cluster) => [String(cluster.id), cluster.name]));
      const data = listPayload(response, "Operations").map((item) => ({
        ...item,
        clusterName: names.get(String(item.clusterId)) ?? `Cluster #${item.clusterId}`,
      }));
      return { clusters, data };
    },

    async getOverview() {
      const clusters = await getClusters();
      const [resources, connectionsResponse, operationsResponse] = await Promise.all([
        Promise.all(clusters.map(async (cluster) => {
          const body = { clusterId: cluster.id, organizationId: apiConfig.organizationId, clusterType: apiConfig.clusterType };
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
        client.post(resourceEndpoints.connections, {}),
        client.post(resourceEndpoints.operations, {}),
      ]);
      return {
        clusters,
        resources,
        connections: listPayload(connectionsResponse, "Connections"),
        operations: listPayload(operationsResponse, "Operations"),
      };
    },
  };
}

export const resourceRepository = createResourceRepository();
