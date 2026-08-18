import assert from "node:assert/strict";
import test from "node:test";
import { createDashboardRepository, dashboardEndpoints } from "../src/api/dashboardRepository.js";

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

test("dashboard endpoints exclude unfinished authentication, relation, health and connection APIs", () => {
  const endpointText = JSON.stringify(dashboardEndpoints).toLowerCase();
  ["/auth", "member", "createeventmeshspace", "queryrelationcluster", "health", "connection", "createtopic", "deletegroup"].forEach((name) => assert.equal(endpointText.includes(name), false));
});
