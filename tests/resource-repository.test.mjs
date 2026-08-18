import assert from "node:assert/strict";
import test from "node:test";
import { createResourceRepository, resourceEndpoints } from "../src/api/resourceRepository.js";

function mysqlBackedClient() {
  return {
    async post(url, body) {
      if (url === resourceEndpoints.clusters) return { data: { code: 200, data: [{ id: 1, name: "east", clusterType: body.clusterType }, { id: 2, name: "west", clusterType: body.clusterType }] } };
      if (url === resourceEndpoints.topics) return { data: [{ id: body.clusterId * 10, topicName: `topic-${body.clusterId}` }] };
      if (url === resourceEndpoints.groups) return { data: [{ id: body.clusterId * 20, name: `group-${body.clusterId}` }] };
      if (url === resourceEndpoints.runtimes) return { data: [{ id: body.clusterId * 30 }] };
      if (url === resourceEndpoints.operations) return { data: [{ id: body.clusterId, content: "Created topic" }] };
      if (url === resourceEndpoints.configs) return { data: [{ id: 1, configName: "eventmesh.server" }] };
      throw new Error(`unexpected endpoint ${url}`);
    },
  };
}

test("aggregates topics, groups and operations across stable cluster queries", async () => {
  const repository = createResourceRepository(mysqlBackedClient());
  const [topics, groups, operations] = await Promise.all([repository.getTopics(), repository.getGroups(), repository.getOperations()]);
  assert.deepEqual(topics.data.map((item) => item.clusterName), ["east", "west"]);
  assert.equal(groups.data.length, 2);
  assert.equal(operations.data[1].clusterName, "west");
});

test("overview contains only verified resource counts and operation rows", async () => {
  const result = await createResourceRepository(mysqlBackedClient()).getOverview();
  assert.equal(result.clusters.length, 2);
  assert.equal(result.resources.reduce((sum, item) => sum + item.runtimes + item.topics + item.groups, 0), 6);
  assert.equal(result.operations.length, 2);
  assert.equal(Object.hasOwn(result, "connections"), false);
});

test("reads configuration and treats an empty cluster list as valid", async () => {
  const repository = createResourceRepository(mysqlBackedClient());
  assert.equal((await repository.getConfigs({ instanceId: 1 }))[0].configName, "eventmesh.server");
  const empty = createResourceRepository({ async post() { return { data: [] }; } });
  assert.deepEqual((await empty.getTopics()).data, []);
});

test("HTTP 200 business errors are rejected", async () => {
  const repository = createResourceRepository({ async post() { return { data: { code: 500, data: "database error" } }; } });
  await assert.rejects(repository.getClusters(), /database error/);
});

test("keeps successful cluster resources when one cluster request fails", async () => {
  const client = {
    async post(url, body) {
      if (url === resourceEndpoints.clusters) {
        if (body.clusterType !== "EVENTMESH_JVM_CLUSTER") return { data: [] };
        return { data: [{ id: 1, name: "healthy", clusterType: body.clusterType }, { id: 2, name: "broken", clusterType: body.clusterType }] };
      }
      if (url === resourceEndpoints.topics && body.clusterId === 2) throw new Error("broken cluster");
      if (url === resourceEndpoints.topics) return { data: [{ id: 11, topicName: "orders" }] };
      throw new Error(`unexpected ${url}`);
    },
  };
  const result = await createResourceRepository(client).getTopics();
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].clusterName, "healthy");
  assert.deepEqual(result.warnings, ["broken cluster"]);
});

test("resource endpoints expose no excluded write, health or connection API", () => {
  const endpointText = JSON.stringify(resourceEndpoints).toLowerCase();
  ["createtopic", "deletegroup", "health", "connection", "member", "auth"].forEach((name) => assert.equal(endpointText.includes(name), false));
});
