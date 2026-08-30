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
