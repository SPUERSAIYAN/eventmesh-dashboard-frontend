import assert from "node:assert/strict";
import test from "node:test";
import { createResourceRepository, resourceEndpoints } from "../src/api/resourceRepository.js";

function mysqlBackedClient() {
  return {
    async post(url, body) {
      if (url === resourceEndpoints.clusters) return { data: { data: [{ id: 1, name: "east" }, { id: 2, name: "west" }] } };
      if (url === resourceEndpoints.topics) return { data: { data: [{ id: body.clusterId * 10, clusterId: body.clusterId, topicName: `topic-${body.clusterId}` }] } };
      if (url === resourceEndpoints.groups) return { data: { data: [{ id: body.clusterId * 20, clusterId: body.clusterId, name: `group-${body.clusterId}` }] } };
      if (url === resourceEndpoints.runtimes) return { data: { data: [{ id: body.clusterId * 30, clusterId: body.clusterId }] } };
      if (url === resourceEndpoints.connections) return { data: { data: [{ id: body.clusterId, clusterId: body.clusterId, clientHost: "10.0.0.1" }] } };
      if (url === resourceEndpoints.operations) return { data: { data: [{ id: body.clusterId, clusterId: body.clusterId, content: "Created topic" }] } };
      throw new Error(`unexpected endpoint ${url}`);
    },
  };
}

test("aggregates topic rows from every database-backed cluster", async () => {
  const repository = createResourceRepository(mysqlBackedClient());
  const result = await repository.getTopics();

  assert.equal(result.data.length, 2);
  assert.deepEqual(result.data.map((item) => item.clusterName), ["east", "west"]);
  assert.deepEqual(result.data.map((item) => item.topicName), ["topic-1", "topic-2"]);
});

test("treats a null list from an empty cluster as no rows", async () => {
  const client = mysqlBackedClient();
  const originalPost = client.post;
  client.post = async (url, body) => {
    if (url === resourceEndpoints.topics && body.clusterId === 2) return { data: { code: 200, data: null } };
    return originalPost(url, body);
  };
  const repository = createResourceRepository(client);

  const result = await repository.getTopics();

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].clusterName, "east");
});

test("joins connection and operation rows with cluster names", async () => {
  const repository = createResourceRepository(mysqlBackedClient());
  const [connections, operations] = await Promise.all([repository.getConnections(), repository.getOperations()]);

  assert.equal(connections.data[0].clusterName, "east");
  assert.equal(operations.data[1].clusterName, "west");
});

test("overview counts only values returned by backend endpoints", async () => {
  const repository = createResourceRepository(mysqlBackedClient());
  const result = await repository.getOverview();

  assert.equal(result.clusters.length, 2);
  assert.equal(result.resources.reduce((sum, item) => sum + item.runtimes, 0), 2);
  assert.equal(result.connections.length, 2);
  assert.equal(result.operations.length, 2);
});

test("keeps clusters returned by healthy cluster-type endpoints", async () => {
  const client = mysqlBackedClient();
  const originalPost = client.post;
  client.post = async (url, body) => {
    if (url === resourceEndpoints.clusters && body.clusterType === "STORAGE_KAFKA_CLUSTER") throw new Error("Kafka cluster query unavailable");
    return originalPost(url, body);
  };
  const repository = createResourceRepository(client);

  const clusters = await repository.getClusters();

  assert.deepEqual(clusters.map((cluster) => cluster.name), ["east", "west"]);
});

test("sorts database health history with the latest check first", async () => {
  const repository = createResourceRepository({
    async get(url) {
      assert.equal(url, resourceEndpoints.healthHistory);
      return { data: { data: [
        { id: 1, finishTime: "2026-08-15T09:00:00" },
        { id: 2, finishTime: "2026-08-15T11:00:00" },
      ] } };
    },
  });

  const checks = await repository.getHealthHistory({ type: 1, instanceId: 11 });

  assert.deepEqual(checks.map((check) => check.id), [2, 1]);
});

test("uses backend mutations for topic creation and group deletion", async () => {
  const requests = [];
  const repository = createResourceRepository({
    async post(url, body) {
      requests.push({ url, body });
      return { data: { code: 200, data: url === resourceEndpoints.createTopic ? 91 : true } };
    },
  });

  await repository.createTopic({ clusterId: 11, clusterType: "EVENTMESH_JVM_CLUSTER", name: " orders ", description: " order events ", partitionsNums: 6, replicasNums: 3, saveTime: 72, cleanupStrategy: 0 });
  await repository.deleteGroup(33);

  assert.equal(requests[0].url, resourceEndpoints.createTopic);
  assert.equal(requests[0].body.name, "orders");
  assert.equal(requests[0].body.clusterId, 11);
  assert.deepEqual(requests[1], { url: resourceEndpoints.deleteGroup, body: { id: 33 } });
});
