import assert from "node:assert/strict";
import test from "node:test";
import { countMetaNodes, createDashboardRepository, dashboardEndpoints } from "../src/api/dashboardRepository.ts";

function liveClient({ failTopics = false } = {}) {
  return {
    async post(url, body) {
      if (url === dashboardEndpoints.clusters) return { data: { code: 200, data: [{ id: 11, name: "live-eventmesh", clusterType: body.clusterType, version: "1.12.0", status: 1 }] } };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 101, clusterId: 11, name: "runtime-a", host: "10.0.0.1", port: 10105, status: 1 }] };
      if (url === dashboardEndpoints.runtimeDetail) return { data: { code: 200, data: { id: 101, name: "runtime-a", host: "10.0.0.1", port: 10105 } } };
      if (url === dashboardEndpoints.topics) {
        if (failTopics) throw new Error("topics unavailable");
        return { data: { records: [{ id: 201 }, { id: 202 }] } };
      }
      if (url === dashboardEndpoints.groups) return { data: { result: [{ id: 301 }] } };
      if (url === dashboardEndpoints.groupsByTopic) return { data: { code: 200, data: [{ id: 301, name: "billing" }] } };
      if (url === dashboardEndpoints.operations) return { data: [{ id: 501, state: 2, content: "Started runtime-a", result: "Success" }] };
      if (url === dashboardEndpoints.topology) return { data: [{ id: 601, name: "metadata-cluster", clusterType: "EVENTMESH_JVM_META", nodeType: "CLUSTER" }] };
      if (url === dashboardEndpoints.createCluster) return { data: { code: 200, data: 701 } };
      throw new Error(`unexpected POST ${url}`);
    },
  };
}

test("uses only stable read endpoints for a cluster dashboard", async () => {
  const result = await createDashboardRepository(liveClient()).getClusterDashboard("live-eventmesh");
  assert.equal(result.data.cluster.id, "11");
  assert.equal(result.data.runtimes[0].host, "10.0.0.1");
  assert.equal(result.data.topicCount, 2);
  assert.equal(result.data.groupCount, 1);
  assert.equal(result.data.topology.children[0].name, "metadata-cluster");
  assert.equal(result.data.recentChanges[0].title, "Started runtime-a");
});

test("homepage query enriches every cluster with live Runtime and Meta node counts", async () => {
  const requests = [];
  const repository = createDashboardRepository({
    async post(url, body) {
      requests.push({ url, body });
      if (url === dashboardEndpoints.homepageClusters) return { data: [{ id: 11, name: "homepage-eventmesh", clusterType: body.clusterType }] };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 101, clusterId: 11, name: "runtime-a" }, { id: 102, clusterId: 11, name: "runtime-b" }] };
      if (url === dashboardEndpoints.topology) return { data: [{ id: 201, nodeType: "CLUSTER", clusterType: "EVENTMESH_JVM_META", children: [{ id: 202, nodeType: "RUNTIME", clusterType: "EVENTMESH_META_ETCD" }] }] };
      throw new Error(`unexpected POST ${url}`);
    },
  });
  const result = await repository.getHomepageClusters();
  assert.equal(result[0].name, "homepage-eventmesh");
  assert.equal(result[0].homepageRuntimeCount, 2);
  assert.equal(result[0].homepageMetaNodeCount, 1);
  assert.deepEqual(requests, [
    { url: dashboardEndpoints.homepageClusters, body: { organizationId: 1, clusterType: "EVENTMESH_JVM_CLUSTER" } },
    { url: dashboardEndpoints.runtimes, body: { clusterId: 11, organizationId: 1, clusterType: "EVENTMESH_JVM_CLUSTER" } },
    { url: dashboardEndpoints.topology, body: { organizationId: 1, clusterId: 11, clusterType: "EVENTMESH_JVM_CLUSTER", deployStatusTypeList: [] } },
  ]);
});

test("loads the detail landscape from basic, Runtime and topology query APIs", async () => {
  const requests = [];
  const repository = createDashboardRepository({
    async post(url, body) {
      requests.push({ url, body });
      if (url === dashboardEndpoints.homepageClusters) return { data: [{
        id: 1001,
        name: "prod-eventmesh-east",
        clusterType: "EVENTMESH_JVM_CLUSTER",
        deployStatusType: "RESET_SUCCESS",
        version: "1.11.0",
        config: JSON.stringify({ region: "华东 1（杭州）" }),
      }] };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 11, name: "runtime-1" }, { id: 12, name: "runtime-2" }] };
      if (url === dashboardEndpoints.topology) return { data: [
        { id: 2001, name: "meta-east", clusterType: "EVENTMESH_JVM_META", deployStatusType: "CREATE_SUCCESS", config: { region: "华东 1（杭州）" }, children: [{ id: 21 }, { id: 22 }] },
        { id: 3001, name: "kafka-east", clusterType: "STORAGE_KAFKA_CLUSTER", deployStatusType: "CREATE_SUCCESS", runtime: [{ id: 31 }, { id: 32 }] },
      ] };
      throw new Error(`unexpected POST ${url}`);
    },
  });

  const result = await repository.getClusterLandscape("prod-eventmesh-east");
  assert.equal(result.data.cluster.id, "1001");
  assert.equal(result.data.cluster.region, "华东 1（杭州）");
  assert.equal(result.data.runtimes.length, 2);
  assert.deepEqual(result.data.components.map((item) => [item.type, item.nodes.length]), [["meta", 2], ["kafka", 2]]);
  assert.equal(result.meta.source, "live");
  assert.deepEqual(requests.map((item) => item.url), [dashboardEndpoints.homepageClusters, dashboardEndpoints.runtimes, dashboardEndpoints.topology]);
});

test("loads the Meta overview from EventMesh topology trees and counts shared relations", async () => {
  const requests = [];
  const repository = createDashboardRepository({
    async post(url, body) {
      requests.push({ url, body });
      if (url === dashboardEndpoints.homepageClusters) return { data: [
        { id: 1001, name: "prod-eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" },
        { id: 1002, name: "prod-eventmesh-south", clusterType: "EVENTMESH_JVM_CLUSTER" },
        { id: 1003, name: "staging-eventmesh", clusterType: "EVENTMESH_JVM_CLUSTER" },
      ] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1001) return { data: [
        { id: 2001, name: "meta-shared", clusterType: "EVENTMESH_JVM_META", deployStatusType: "CREATE_SUCCESS", children: [{ id: 20101, nodeType: "RUNTIME", deployStatusType: "CREATE_SUCCESS" }] },
      ] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1002) return { data: [
        { id: 2001, name: "meta-shared", clusterType: "EVENTMESH_JVM_META", deployStatusType: "CREATE_SUCCESS", children: [{ id: 20101, nodeType: "RUNTIME", deployStatusType: "CREATE_SUCCESS" }] },
      ] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1003) return { data: [
        { id: 2002, name: "meta-staging", clusterType: "EVENTMESH_META_NACOS", deployStatusType: "CREATE_SUCCESS", children: null },
      ] };
      throw new Error(`unexpected POST ${url}`);
    },
  });

  const result = await repository.getMetaOverview("prod-eventmesh-south");
  assert.equal(result.data.components.length, 1);
  assert.equal(result.data.components[0].name, "meta-shared");
  assert.equal(result.data.components[0].referenceCount, 2);
  assert.equal(result.data.components[0].nodes.length, 1);
  assert.equal(result.data.relationCount, 3);
  assert.equal(result.data.nodesAvailable, true);
  assert.equal(result.meta.source, "live");
  assert.deepEqual(requests.map((item) => item.url), [
    dashboardEndpoints.homepageClusters,
    dashboardEndpoints.topology,
    dashboardEndpoints.topology,
    dashboardEndpoints.topology,
  ]);
});

test("keeps the current Meta overview live when another EventMesh topology fails", async () => {
  const repository = createDashboardRepository({
    async post(url, body) {
      if (url === dashboardEndpoints.homepageClusters) return { data: [
        { id: 1001, name: "prod-eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" },
        { id: 1002, name: "prod-eventmesh-south", clusterType: "EVENTMESH_JVM_CLUSTER" },
      ] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1001) return { data: [
        { id: 2001, name: "meta-shared", clusterType: "EVENTMESH_JVM_META", children: [] },
      ] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1002) throw new Error("topology unavailable");
      throw new Error(`unexpected POST ${url}`);
    },
  });

  const result = await repository.getMetaOverview("prod-eventmesh-east");
  assert.equal(result.data.components.length, 1);
  assert.equal(result.data.queriedEventMeshClusterCount, 1);
  assert.equal(result.meta.source, "mixed");
  assert.match(result.meta.warnings[0], /prod-eventmesh-south/);
});

test("loads the Meta cluster list from cluster, Runtime and EventMesh topology queries", async () => {
  const requests = [];
  const repository = createDashboardRepository({
    async post(url, body) {
      requests.push({ url, body });
      if (url === dashboardEndpoints.homepageClusters) return { data: [
        { id: 1001, name: "prod-eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" },
        { id: 1002, name: "prod-eventmesh-south", clusterType: "EVENTMESH_JVM_CLUSTER" },
      ] };
      if (url === dashboardEndpoints.clusters && body.clusterType === "EVENTMESH_JVM_META") return { data: [
        { id: 2001, name: "meta-east-primary", clusterType: "EVENTMESH_JVM_META", version: "1.11.0", deployStatusType: "CREATE_SUCCESS", description: "ETCD Meta", config: { region: "华东 1（杭州）" } },
      ] };
      if (url === dashboardEndpoints.clusters && body.clusterType === "EVENTMESH_META_NACOS") return { data: [
        { id: 2002, name: "meta-north-nacos", clusterType: "EVENTMESH_META_NACOS", version: "2.3.2", deployStatusType: "CREATE_SUCCESS", description: "Nacos Meta", config: { region: "华北 2（北京）" } },
      ] };
      if (url === dashboardEndpoints.clusters && body.clusterType === "EVENTMESH_META_ETCD") return { data: [] };
      if (url === dashboardEndpoints.runtimes && body.clusterId === 2001) return { data: [{ id: 20101, name: "meta-east-01", deployStatusType: "CREATE_SUCCESS" }] };
      if (url === dashboardEndpoints.runtimes && body.clusterId === 2002) return { data: [] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1001) return { data: [
        { id: 2001, name: "meta-east-primary", clusterType: "EVENTMESH_JVM_META", children: [] },
      ] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1002) return { data: [
        { id: 2001, name: "meta-east-primary", clusterType: "EVENTMESH_JVM_META", children: [] },
      ] };
      throw new Error(`unexpected POST ${url}`);
    },
  });

  const result = await repository.getMetaClusterList("prod-eventmesh-south");
  assert.deepEqual(result.data.clusters.map((item) => [item.id, item.nodes.length, item.referenceCount, item.currentAssociated]), [
    ["2001", 1, 2, true],
    ["2002", 0, 0, false],
  ]);
  assert.deepEqual(result.data.clusters[0].relatedEventMeshes.map((item) => [item.id, item.routeId]), [
    ["1001", "prod-eventmesh-east"],
    ["1002", "prod-eventmesh-south"],
  ]);
  assert.deepEqual(result.data.clusters[1].relatedEventMeshes, []);
  assert.equal(result.data.referenceCountsComplete, true);
  assert.equal(result.meta.source, "live");
  assert.equal(requests.filter((item) => item.url === dashboardEndpoints.clusters).length, 3);
  assert.equal(requests.filter((item) => item.url === dashboardEndpoints.runtimes).length, 2);
  assert.equal(requests.filter((item) => item.url === dashboardEndpoints.topology).length, 2);
});

test("keeps available Meta rows when one Meta cluster type query fails", async () => {
  const repository = createDashboardRepository({
    async post(url, body) {
      if (url === dashboardEndpoints.homepageClusters) return { data: [{ id: 1001, name: "prod-eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" }] };
      if (url === dashboardEndpoints.clusters && body.clusterType === "EVENTMESH_JVM_META") return { data: [{ id: 2001, name: "meta-east", clusterType: "EVENTMESH_JVM_META" }] };
      if (url === dashboardEndpoints.clusters && body.clusterType === "EVENTMESH_META_NACOS") throw new Error("Nacos list unavailable");
      if (url === dashboardEndpoints.clusters) return { data: [] };
      if (url === dashboardEndpoints.runtimes) return { data: [] };
      if (url === dashboardEndpoints.topology) return { data: [] };
      throw new Error(`unexpected POST ${url}`);
    },
  });

  const result = await repository.getMetaClusterList("prod-eventmesh-east");
  assert.equal(result.data.clusters.length, 1);
  assert.equal(result.meta.source, "mixed");
  assert.match(result.meta.warnings[0], /Nacos list unavailable/);
});

test("loads the storage overview from Kafka and RocketMQ clusters plus EventMesh topology trees", async () => {
  const requests = [];
  const repository = createDashboardRepository({
    async post(url, body) {
      requests.push({ url, body });
      if (url === dashboardEndpoints.homepageClusters) return { data: [
        { id: 1001, name: "prod-eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" },
        { id: 1002, name: "prod-eventmesh-south", clusterType: "EVENTMESH_JVM_CLUSTER" },
      ] };
      if (url === dashboardEndpoints.clusters && body.clusterType === "STORAGE_KAFKA_CLUSTER") return { data: [
        { id: 3001, name: "kafka-orders", clusterType: "STORAGE_KAFKA_CLUSTER", version: "3.8.1", deployStatusType: "CREATE_SUCCESS", config: { region: "华东 1（杭州）" } },
      ] };
      if (url === dashboardEndpoints.clusters && body.clusterType === "STORAGE_ROCKETMQ_CLUSTER") return { data: [
        { id: 4001, name: "rocketmq-shared", clusterType: "STORAGE_ROCKETMQ_CLUSTER", version: "5.3.1", deployStatusType: "CREATE_SUCCESS", config: { region: "华南 1（深圳）" } },
      ] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1001) return { data: [
        { id: 3001, name: "kafka-orders", clusterType: "STORAGE_KAFKA_CLUSTER", children: [] },
      ] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1002) return { data: [
        { id: 4001, name: "rocketmq-shared", clusterType: "STORAGE_ROCKETMQ_CLUSTER", children: [] },
      ] };
      if (url === dashboardEndpoints.runtimes && body.clusterId === 4001) return { data: [
        { id: 4101, name: "rocketmq-broker-01", deployStatusType: "CREATE_SUCCESS" },
        { id: 4102, name: "rocketmq-broker-02", deployStatusType: "CREATE_SUCCESS" },
      ] };
      throw new Error(`unexpected POST ${url}`);
    },
  });

  const result = await repository.getStorageOverview("prod-eventmesh-south");
  assert.equal(result.data.inventoryCount, 2);
  assert.equal(result.data.components.length, 1);
  assert.equal(result.data.components[0].name, "rocketmq-shared");
  assert.equal(result.data.components[0].nodes.length, 2);
  assert.equal(result.data.components[0].referenceCount, 1);
  assert.equal(result.data.relationCount, 2);
  assert.equal(result.meta.source, "live");
  assert.equal(requests.filter((item) => item.url === dashboardEndpoints.clusters).length, 2);
  assert.equal(requests.filter((item) => item.url === dashboardEndpoints.topology).length, 2);
  assert.equal(requests.filter((item) => item.url === dashboardEndpoints.runtimes).length, 1);
});

test("loads Runtime pages from the EventMesh cluster and direct Runtime query", async () => {
  const requests = [];
  const repository = createDashboardRepository({
    async post(url, body) {
      requests.push({ url, body });
      if (url === dashboardEndpoints.homepageClusters) return { data: [{ id: 1002, name: "prod-eventmesh-south", clusterType: "EVENTMESH_JVM_CLUSTER", version: "1.11.0", config: JSON.stringify({ region: "华南 1（深圳）" }) }] };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 10201, clusterId: 1002, name: "runtime-south-01", clusterType: "EVENTMESH_JVM_RUNTIME", host: "169607435", port: 10000, jmxPort: 10105, rack: "rack-a", version: "1.11.0", replicationType: "MAIN", deployStatusType: "RESET_SUCCESS", createTime: "2026-08-28T14:03:52" }] };
      throw new Error(`unexpected POST ${url}`);
    },
  });
  const result = await repository.getEventMeshRuntimes("prod-eventmesh-south");
  assert.equal(result.data.cluster.id, "1002");
  assert.equal(result.data.runtimes[0].clusterId, "1002");
  assert.equal(result.data.runtimes[0].host, "10.28.1.11");
  assert.equal(result.data.runtimes[0].replicationType, "MAIN");
  assert.equal(result.data.runtimes[0].rack, "rack-a");
  assert.equal(result.data.runtimes[0].deployStatus, "RESET_SUCCESS");
  assert.deepEqual(requests.map((item) => item.url), [dashboardEndpoints.homepageClusters, dashboardEndpoints.runtimes]);
});

test("keeps confirmed landscape data and marks unavailable sibling queries", async () => {
  const repository = createDashboardRepository({
    async post(url) {
      if (url === dashboardEndpoints.homepageClusters) return { data: [{ id: 1001, name: "prod-eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" }] };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 11, name: "runtime-1" }] };
      if (url === dashboardEndpoints.topology) throw new Error("topology unavailable");
      throw new Error(`unexpected POST ${url}`);
    },
  });

  const result = await repository.getClusterLandscape("1001");
  assert.equal(result.data.runtimes.length, 1);
  assert.equal(result.data.topologyAvailable, false);
  assert.equal(result.meta.source, "mixed");
  assert.match(result.meta.warnings[0], /topology unavailable/);
});

test("loads the EventMesh overview without manufacturing unavailable metrics", async () => {
  const repository = createDashboardRepository({
    async post(url) {
      if (url === dashboardEndpoints.homepageClusters) return { data: [{
        id: 1001,
        name: "prod-eventmesh-east",
        clusterType: "EVENTMESH_JVM_CLUSTER",
        deployStatusType: "RESET_SUCCESS",
        trusteeshipType: "TRUSTEESHIP",
        version: "1.11.0",
        config: JSON.stringify({ region: "华东 1（杭州）", cloudProvider: "Alibaba Cloud ACK", kubernetesCluster: "ack-prod-east-01" }),
      }] };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 11 }, { id: 12 }, { id: 13 }] };
      if (url === dashboardEndpoints.topology) return { data: [
        { id: 2001, clusterType: "EVENTMESH_JVM_META", children: [{ id: 21 }, { id: 22 }] },
        { id: 3001, clusterType: "STORAGE_KAFKA_CLUSTER", children: [{ id: 31 }, { id: 32 }] },
      ] };
      if (url === dashboardEndpoints.topics) return { data: [{ id: 41 }, { id: 42 }] };
      if (url === dashboardEndpoints.groups) return { data: [{ id: 51 }] };
      throw new Error(`unexpected POST ${url}`);
    },
  });

  const result = await repository.getEventMeshOverview("prod-eventmesh-east");
  assert.equal(result.data.cluster.cloudProvider, "Alibaba Cloud ACK");
  assert.equal(result.data.cluster.kubernetesCluster, "ack-prod-east-01");
  assert.equal(result.data.runtimes.length, 3);
  assert.equal(result.data.components[0].nodes.length, 2);
  assert.equal(result.data.topics.length, 2);
  assert.equal(result.data.groups.length, 1);
  assert.equal("cpu" in result.data.cluster, false);
  assert.equal("inRate" in result.data.cluster, false);
});

test("marks only failed EventMesh overview sections as unavailable", async () => {
  const repository = createDashboardRepository({
    async post(url) {
      if (url === dashboardEndpoints.homepageClusters) return { data: [{ id: 1001, name: "prod-eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" }] };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 11 }] };
      if (url === dashboardEndpoints.topology) return { data: [] };
      if (url === dashboardEndpoints.topics) throw new Error("topics unavailable");
      if (url === dashboardEndpoints.groups) return { data: [{ id: 51 }] };
      throw new Error(`unexpected POST ${url}`);
    },
  });

  const result = await repository.getEventMeshOverview("1001");
  assert.equal(result.data.availability.runtimes, true);
  assert.equal(result.data.availability.topics, false);
  assert.equal(result.data.availability.groups, true);
  assert.equal(result.meta.source, "mixed");
  assert.match(result.meta.warnings[0], /topics unavailable/);
});

test("counts distinct Runtime children under Meta topology clusters", () => {
  assert.equal(countMetaNodes([
    { id: 1, nodeType: "CLUSTER", clusterType: "EVENTMESH_JVM_META", children: [
      { id: 11, nodeType: "RUNTIME", clusterType: "EVENTMESH_META_ETCD" },
      { id: 12, nodeType: "RUNTIME", clusterType: "EVENTMESH_META_ETCD" },
    ] },
    { id: 2, nodeType: "CLUSTER", clusterType: "STORAGE_KAFKA_CLUSTER", children: [
      { id: 21, nodeType: "RUNTIME", clusterType: "STORAGE_KAFKA_BROKER" },
    ] },
  ]), 2);
});

test("does not report zero when a Meta cluster omits its node list", () => {
  assert.equal(countMetaNodes([
    { id: 1, nodeType: "CLUSTER", clusterType: "EVENTMESH_JVM_META", children: null },
  ]), null);
});

test("keeps homepage clusters when one node query fails", async () => {
  const repository = createDashboardRepository({
    async post(url) {
      if (url === dashboardEndpoints.homepageClusters) return { data: [{ id: 11, name: "homepage-eventmesh", clusterType: "EVENTMESH_JVM_CLUSTER" }] };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 101, name: "runtime-a" }] };
      if (url === dashboardEndpoints.topology) throw new Error("topology unavailable");
      throw new Error(`unexpected POST ${url}`);
    },
  });
  const [cluster] = await repository.getHomepageClusters();
  assert.equal(cluster.homepageRuntimeCount, 1);
  assert.equal(cluster.homepageMetaNodeCount, null);
  assert.match(cluster.homepageNodeWarnings[0], /topology unavailable/);
});

test("homepage query accepts bare, data and records list payloads", async () => {
  const rows = [{ id: 11, name: "homepage-eventmesh", clusterType: "EVENTMESH_JVM_CLUSTER" }];
  for (const payload of [rows, { data: rows }, { records: rows }]) {
    const repository = createDashboardRepository({ async post() { return { data: payload }; } });
    assert.equal((await repository.getHomepageClusters())[0].id, 11);
  }
});

test("keeps successful sibling endpoint data after a partial failure", async () => {
  const result = await createDashboardRepository(liveClient({ failTopics: true })).getClusterDashboard("11");
  assert.equal(result.data.groupCount, 1);
  assert.equal(result.meta.sources.topics, "unavailable");
  assert.match(result.meta.fallbackReason, /topics unavailable/);
});

test("loads Runtime details and groups by Topic ID", async () => {
  const repository = createDashboardRepository(liveClient());
  assert.equal((await repository.getRuntimeById(101)).name, "runtime-a");
  assert.equal((await repository.getGroupsByTopicId(201))[0].name, "billing");
});

test("creates a cluster with the current backend DTO and fixed organization", async () => {
  let request;
  const repository = createDashboardRepository({ async post(url, body) { request = { url, body }; return { data: { code: 200, data: 701 } }; } });
  const result = await repository.createCluster({ parentClusterId: 11, name: "  edge-east  ", version: " 1.12.0 ", clusterType: "EVENTMESH_JVM_CLUSTER", description: " production ", firstToWhom: "DASHBOARD", trusteeshipArrangeType: "NOT" });
  assert.equal(request.url, "/organization/activeCreate/createCluster");
  assert.deepEqual(request.body, { organizationId: 1, clusterId: 11, clusterType: "EVENTMESH_JVM_CLUSTER", name: "edge-east", version: "1.12.0", description: "production", firstToWhom: "DASHBOARD", trusteeshipArrangeType: "NOT" });
  assert.deepEqual(result, { id: "701", name: "edge-east" });
});

test("rejects a business failure returned by createCluster", async () => {
  const repository = createDashboardRepository({ async post() { return { data: { code: 500, message: "create failed" } }; } });
  await assert.rejects(repository.createCluster({ parentClusterId: 11, name: "edge-east", version: "1.12.0", description: "production" }), /create failed/);
});

test("accepts an empty live cluster list and rejects total API failure", async () => {
  const empty = createDashboardRepository({ async post() { return { data: [] }; } });
  assert.deepEqual((await empty.getClusters()).data, []);
  const unavailable = createDashboardRepository({ async post() { throw new Error("ECONNREFUSED"); } });
  await assert.rejects(unavailable.getClusters(), /ECONNREFUSED/);
});

test("dashboard endpoints exclude unfinished write, authentication, relation, health and connection APIs", () => {
  const endpointText = JSON.stringify(dashboardEndpoints).toLowerCase();
  ["clustercycledeploy", "/auth", "member", "createeventmeshspace", "queryrelationcluster", "health", "connection", "createtopic", "deletegroup"].forEach((name) => assert.equal(endpointText.includes(name), false));
});

test("loads Kafka inventory, Brokers and EventMesh reference counts from backend APIs", async () => {
  const repository = createDashboardRepository({
    async post(url, body) {
      if (url === dashboardEndpoints.homepageClusters) return { data: [
        { id: 1001, name: "eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" },
        { id: 1002, name: "eventmesh-south", clusterType: "EVENTMESH_JVM_CLUSTER" },
      ] };
      if (url === dashboardEndpoints.clusters) return { data: [{ id: 3001, name: "kafka-orders", clusterType: body.clusterType, version: "3.8.1", deployStatusType: "CREATE_SUCCESS" }] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1001) return { data: [{ id: 3001, name: "kafka-orders", clusterType: "STORAGE_KAFKA_CLUSTER" }] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1002) return { data: [{ id: 3001, name: "kafka-orders", clusterType: "STORAGE_KAFKA_CLUSTER" }] };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 31, name: "broker-1", host: "10.0.0.31", port: 9092 }, { id: 32, name: "broker-2", host: "10.0.0.32", port: 9092 }] };
      throw new Error(`unexpected POST ${url}`);
    },
  });
  const result = await repository.getKafkaClusterList("eventmesh-south");
  assert.equal(result.data.clusters[0].nodes.length, 2);
  assert.equal(result.data.clusters[0].referenceCount, 2);
  assert.equal(result.data.clusters[0].currentAssociated, true);
  assert.equal(result.meta.source, "live");
});

test("loads Kafka Topic and consumer-group fields while preserving unavailable-field boundaries", async () => {
  const repository = createDashboardRepository({
    async post(url, body) {
      if (url === dashboardEndpoints.homepageClusters) return { data: [{ id: 1001, name: "eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" }] };
      if (url === dashboardEndpoints.clusters) return { data: [{ id: 3001, name: "kafka-orders", clusterType: body.clusterType }] };
      if (url === dashboardEndpoints.topology) return { data: [{ id: 3001, name: "kafka-orders", clusterType: "STORAGE_KAFKA_CLUSTER" }] };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 31, name: "broker-1", host: "10.0.0.31", port: 9092 }] };
      if (url === dashboardEndpoints.topics) return { data: [{ id: 41, topicName: "orders", readQueueNum: 12, writeQueueNum: 12, replicationFactor: 3 }] };
      if (url === dashboardEndpoints.groups) return { data: [{ id: 51, name: "order-workers", ownType: "KAFKA" }] };
      throw new Error(`unexpected POST ${url}`);
    },
  });
  const result = await repository.getKafkaClusterDetail("eventmesh-east", "3001");
  assert.equal(result.data.topics[0].name, "orders");
  assert.equal(result.data.topics[0].partitions, 12);
  assert.equal(result.data.topics[0].replicas, 3);
  assert.equal(result.data.groups[0].name, "order-workers");
  assert.equal(result.data.groups[0].ownType, "KAFKA");
  assert.equal(result.data.topicsAvailable, true);
  assert.equal(result.data.groupsAvailable, true);
});

test("loads RocketMQ inventory, Brokers, Topics, groups and EventMesh references with the Kafka data boundary", async () => {
  const requests = [];
  const repository = createDashboardRepository({
    async post(url, body) {
      requests.push({ url, body });
      if (url === dashboardEndpoints.homepageClusters) return { data: [
        { id: 1001, name: "eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" },
        { id: 1002, name: "eventmesh-south", clusterType: "EVENTMESH_JVM_CLUSTER" },
      ] };
      if (url === dashboardEndpoints.clusters) return { data: [{ id: 4001, name: "rocketmq-orders", clusterType: body.clusterType, version: "5.3.1", deployStatusType: "CREATE_SUCCESS" }] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1001) return { data: [{ id: 4001, name: "rocketmq-orders", clusterType: "STORAGE_ROCKETMQ_CLUSTER" }] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1002) return { data: [{ id: 4001, name: "rocketmq-orders", clusterType: "STORAGE_ROCKETMQ_CLUSTER" }] };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 61, name: "broker-a", host: "10.0.0.61", port: 10911, clusterType: "STORAGE_ROCKETMQ_BROKER_MAIN_SLAVE" }] };
      if (url === dashboardEndpoints.topics) return { data: [{ id: 71, topicName: "orders", readQueueNum: 8, writeQueueNum: 8, replicationFactor: 2 }] };
      if (url === dashboardEndpoints.groups) return { data: [{ id: 81, name: "order-workers", ownType: "ROCKETMQ" }] };
      throw new Error(`unexpected POST ${url}`);
    },
  });
  const list = await repository.getRocketMqClusterList("eventmesh-south");
  assert.equal(list.data.clusters[0].nodes.length, 1);
  assert.equal(list.data.clusters[0].nodes[0].clusterType, "STORAGE_ROCKETMQ_BROKER_MAIN_SLAVE");
  assert.equal(list.data.clusters[0].referenceCount, 2);
  assert.equal(list.data.clusters[0].currentAssociated, true);
  const detail = await repository.getRocketMqClusterDetail("eventmesh-east", "4001");
  assert.equal(detail.data.topics[0].name, "orders");
  assert.equal(detail.data.topics[0].partitions, 8);
  assert.equal(detail.data.groups[0].name, "order-workers");
  assert.equal(detail.data.groups[0].ownType, "ROCKETMQ");
  assert.equal(requests.some((item) => item.url === dashboardEndpoints.clusters && item.body.clusterType === "STORAGE_ROCKETMQ_CLUSTER"), true);
});

test("loads the storage relationship list from Kafka and RocketMQ EventMesh topology trees", async () => {
  const repository = createDashboardRepository({
    async post(url, body) {
      if (url === dashboardEndpoints.homepageClusters) return { data: [
        { id: 1001, name: "eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" },
        { id: 1002, name: "eventmesh-south", clusterType: "EVENTMESH_JVM_CLUSTER" },
      ] };
      if (url === dashboardEndpoints.clusters && body.clusterType === "STORAGE_KAFKA_CLUSTER") return { data: [{ id: 3001, name: "kafka-orders", clusterType: body.clusterType }] };
      if (url === dashboardEndpoints.clusters && body.clusterType === "STORAGE_ROCKETMQ_CLUSTER") return { data: [{ id: 4001, name: "rocketmq-shared", clusterType: body.clusterType }] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1001) return { data: [
        { id: 3001, name: "kafka-orders", clusterType: "STORAGE_KAFKA_CLUSTER" },
        { id: 4001, name: "rocketmq-shared", clusterType: "STORAGE_ROCKETMQ_CLUSTER" },
      ] };
      if (url === dashboardEndpoints.topology && body.clusterId === 1002) return { data: [
        { id: 4001, name: "rocketmq-shared", clusterType: "STORAGE_ROCKETMQ_CLUSTER" },
      ] };
      if (url === dashboardEndpoints.runtimes && body.clusterId === 3001) return { data: [{ id: 31, name: "kafka-broker" }] };
      if (url === dashboardEndpoints.runtimes && body.clusterId === 4001) return { data: [{ id: 41, name: "rocketmq-broker" }] };
      throw new Error(`unexpected POST ${url}`);
    },
  });
  const result = await repository.getStorageRelationshipList("eventmesh-east");
  assert.deepEqual(result.data.relationships.map((item) => [item.component.type, item.component.name, item.eventMesh.name, item.current]), [
    ["kafka", "kafka-orders", "eventmesh-east", true],
    ["rocketmq", "rocketmq-shared", "eventmesh-east", true],
    ["rocketmq", "rocketmq-shared", "eventmesh-south", false],
  ]);
  assert.equal(result.data.relationships[0].component.nodes.length, 1);
  assert.equal(result.data.relationships[0].createTime, null);
  assert.equal(result.meta.source, "live");
});

test("loads the Topic overview count and queue configuration from the backend", async () => {
  const requests = [];
  const repository = createDashboardRepository({
    async post(url, body) {
      requests.push({ url, body });
      if (url === dashboardEndpoints.homepageClusters) return { data: [{ id: 1001, name: "eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" }] };
      if (url === dashboardEndpoints.topics) return { data: [
        { id: 71, topicName: "orders", readQueueNum: 8, writeQueueNum: 12, replicationFactor: 3 },
        { id: 72, topicName: "payments", readQueueNum: 4, writeQueueNum: 4, replicationFactor: 2 },
      ] };
      throw new Error(`unexpected POST ${url}`);
    },
  });
  const result = await repository.getTopicOverview("eventmesh-east");
  assert.deepEqual(result.data.topics.map((item) => [item.name, item.partitions]), [["orders", 12], ["payments", 4]]);
  assert.equal(result.data.queueCount, 16);
  assert.equal(result.data.queueCountComplete, true);
  assert.deepEqual(requests, [
    { url: dashboardEndpoints.homepageClusters, body: { organizationId: 1, clusterType: "EVENTMESH_JVM_CLUSTER" } },
    { url: dashboardEndpoints.topics, body: { clusterId: 1001, organizationId: 1, clusterType: "EVENTMESH_JVM_CLUSTER", topicName: null } },
  ]);
});

test("loads consumer groups and their Topic subscriptions from the backend", async () => {
  const requests = [];
  const repository = createDashboardRepository({
    async post(url, body) {
      requests.push({ url, body });
      if (url === dashboardEndpoints.homepageClusters) return { data: [{ id: 1001, name: "eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" }] };
      if (url === dashboardEndpoints.groups) return { data: [
        { id: 6001, name: "order-service", type: 0, ownType: "USER", status: 1, createTime: "2026-08-28T14:03:52" },
        { id: 6101, name: "order-producer", type: 1, ownType: "USER", status: 1 },
      ] };
      if (url === dashboardEndpoints.topics) return { data: [{ id: 5001, topicName: "order-created" }] };
      if (url === dashboardEndpoints.groupsByTopic) return { data: [{ id: 6001, name: "order-service", type: 0 }] };
      throw new Error(`unexpected POST ${url}`);
    },
  });
  const result = await repository.getConsumerGroups("eventmesh-east");
  assert.equal(result.data.groups.length, 1);
  assert.deepEqual(result.data.groups[0].topics, ["order-created"]);
  assert.equal(result.data.groups[0].databaseStatus, 1);
  assert.equal(result.data.groups[0].ownType, "USER");
  assert.deepEqual(requests.at(-1), { url: dashboardEndpoints.groupsByTopic, body: { id: 5001 } });
});

test("loads operation history fields from the backend without treating state as deploy status", async () => {
  const requests = [];
  const repository = createDashboardRepository({
    async post(url, body) {
      requests.push({ url, body });
      if (url === dashboardEndpoints.homepageClusters) return { data: [{ id: 1001, name: "eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" }] };
      if (url === dashboardEndpoints.operations) return { data: [
        { id: 1, clusterId: 1001, operationType: "CREATE", targetType: "CLUSTER", state: 2, content: "创建集群", operationUser: "admin", result: "Success", createTime: "2026-07-29T14:03:52" },
      ] };
      throw new Error(`unexpected POST ${url}`);
    },
  });
  const result = await repository.getOperationHistory("eventmesh-east");
  assert.deepEqual(result.data.operations[0], {
    id: "1", clusterId: "1001", operationType: "CREATE", targetType: "CLUSTER", state: 2,
    content: "创建集群", createTime: "2026-07-29T14:03:52", endTime: null, operationUser: "admin", result: "Success",
  });
  assert.deepEqual(requests.at(-1), { url: dashboardEndpoints.operations, body: { clusterId: 1001 } });
});

test("keeps backend Kafka rows from EventMesh topology when the inventory query is unavailable", async () => {
  const repository = createDashboardRepository({
    async post(url, body) {
      if (url === dashboardEndpoints.homepageClusters) return { data: [{ id: 1001, name: "eventmesh-east", clusterType: "EVENTMESH_JVM_CLUSTER" }] };
      if (url === dashboardEndpoints.clusters) throw new Error("inventory unavailable");
      if (url === dashboardEndpoints.topology) return { data: [{ id: 3001, name: "kafka-from-tree", clusterType: "STORAGE_KAFKA_CLUSTER" }] };
      if (url === dashboardEndpoints.runtimes) return { data: [{ id: 31, name: "broker-1" }] };
      throw new Error(`unexpected POST ${url} ${body?.clusterType ?? ""}`);
    },
  });
  const result = await repository.getKafkaClusterList("eventmesh-east");
  assert.equal(result.data.clusters[0].name, "kafka-from-tree");
  assert.equal(result.data.clusters[0].nodes.length, 1);
  assert.equal(result.meta.source, "mixed");
  assert.match(result.meta.warnings[0], /inventory unavailable/);
});
