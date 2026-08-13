import assert from "node:assert/strict";
import test from "node:test";
import { createDashboardRepository, dashboardEndpoints } from "../src/api/dashboardRepository.js";

function liveClient({ failTopics = false } = {}) {
  return {
    async post(url) {
      if (url === dashboardEndpoints.clusters) {
        return { data: { data: [{ id: 11, name: "live-eventmesh", version: "1.12.0", status: 1, createTime: "2026-08-01T08:30:00" }] } };
      }
      if (url === dashboardEndpoints.runtimes) {
        return { data: [{ id: 101, clusterId: 11, name: "runtime-a", host: "10.0.0.1", port: 10105, status: 1 }] };
      }
      if (url === dashboardEndpoints.topics) {
        if (failTopics) throw new Error("topics unavailable");
        return { data: { records: [{ id: 201 }, { id: 202 }] } };
      }
      if (url === dashboardEndpoints.groups) {
        return { data: { result: [{ id: 301 }] } };
      }
      if (url === dashboardEndpoints.connections) {
        return { data: { data: [{ id: 401, runtimeId: 101 }] } };
      }
      if (url === dashboardEndpoints.operations) {
        return { data: { data: [{ id: 501, state: 2, content: "Started runtime-a", result: "Success", createTime: "2026-08-01T09:00:00" }] } };
      }
      throw new Error(`unexpected POST ${url}`);
    },
    async get(url) {
      assert.equal(url, dashboardEndpoints.health);
      return { data: { data: { abnormalNum: 0, allNum: 1 } } };
    },
  };
}

test("uses validated live controller and database data without fabricated metrics", async () => {
  const repository = createDashboardRepository(liveClient());
  const result = await repository.getClusterDashboard("live-eventmesh");

  assert.equal(result.data.cluster.id, "11");
  assert.equal(result.data.cluster.name, "live-eventmesh");
  assert.equal(result.data.cluster.version, "1.12.0");
  assert.equal(result.data.cluster.runtimes, 1);
  assert.equal(result.data.topicCount, 2);
  assert.equal(result.data.groupCount, 1);
  assert.equal(result.data.runtimes[0].host, "10.0.0.1");
  assert.equal(result.data.runtimes[0].cpu, null);
  assert.equal(result.data.runtimes[0].connections, 1);
  assert.equal(result.data.recentChanges[0].title, "Started runtime-a");
  assert.equal(result.meta.source, "mixed");
  assert.equal(result.meta.sources.cluster, "api");
  assert.equal(result.meta.sources.throughput, "unavailable");
  assert.equal(result.meta.sources.changes, "api");
});

test("keeps successful endpoints when a sibling endpoint fails", async () => {
  const repository = createDashboardRepository(liveClient({ failTopics: true }));
  const result = await repository.getClusterDashboard("11");

  assert.equal(result.data.cluster.name, "live-eventmesh");
  assert.equal(result.data.groupCount, 1);
  assert.equal(result.meta.sources.topics, "unavailable");
  assert.match(result.meta.fallbackReason, /topics unavailable/);
});

test("does not fall back to mock production data when the dashboard API is unavailable", async () => {
  const unavailableClient = {
    async post() { throw new Error("connect ECONNREFUSED 127.0.0.1:9898"); },
    async get() { throw new Error("should not be called"); },
  };
  const repository = createDashboardRepository(unavailableClient);
  await assert.rejects(repository.getClusters(), /ECONNREFUSED/);
  await assert.rejects(repository.getClusterDashboard("prod-eventmesh-east"), /ECONNREFUSED/);
});

test("treats an empty live cluster list as a valid API result", async () => {
  const repository = createDashboardRepository({
    async post() { return { data: [] }; },
    async get() { throw new Error("should not be called"); },
  });
  const result = await repository.getClusters();

  assert.equal(result.meta.source, "live");
  assert.deepEqual(result.data, []);
});

test("creates a basic cluster through the documented active-create endpoint", async () => {
  let request;
  const repository = createDashboardRepository({
    async post(url, body) {
      assert.equal(url, dashboardEndpoints.createCluster);
      request = body;
      return { data: { code: 200, data: 42 } };
    },
  });

  const result = await repository.createCluster({
    name: " dev-eventmesh-north ",
    version: " 1.11.0 ",
    clusterType: "EVENTMESH_JVM_CLUSTER",
    description: " Development cluster ",
  });

  assert.deepEqual(result, { id: "42", name: "dev-eventmesh-north" });
  assert.deepEqual(request, {
    organizationId: 1,
    clusterType: "EVENTMESH_JVM_CLUSTER",
    name: "dev-eventmesh-north",
    version: "1.11.0",
    description: "Development cluster",
    firstToWhom: "DASHBOARD",
    trusteeshipArrangeType: "SELF",
  });
});
