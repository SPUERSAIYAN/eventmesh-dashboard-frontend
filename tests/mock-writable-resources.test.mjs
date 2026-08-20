import assert from "node:assert/strict";
import test from "node:test";
import { addWritableConsumer, addWritableNode, addWritablePhysicalTopic, addWritableTopic, defaultWritableResourceState, ensureSimName, normalizeWritableResourceState } from "../src/mockWritableResources.ts";

test("falls back from damaged writable mock state", () => {
  assert.deepEqual(normalizeWritableResourceState({ version: 0, nodes: [1] }), defaultWritableResourceState());
});

test("adds writable resources once and synchronizes business Topic to physical storage", () => {
  const node = { clusterId: "runtime-a", name: "codex-sim-runtime-new-01" };
  let state = addWritableNode(defaultWritableResourceState(), node);
  state = addWritableNode(state, node);
  assert.equal(state.nodes.length, 1);
  state = addWritableTopic(state, { id: "topic-1", eventMeshClusterId: "eventmesh-a", storageClusterId: "kafka-a", engine: "kafka", name: "codex-sim-orders", partitions: 12, replicas: 3 });
  assert.equal(state.topics.length, 1);
  assert.equal(state.physicalTopics[0].storageClusterId, "kafka-a");
  state = addWritablePhysicalTopic(state, { storageClusterId: "kafka-a", name: "codex-sim-orders" });
  assert.equal(state.physicalTopics.length, 1);
  state = addWritableConsumer(state, { eventMeshClusterId: "eventmesh-a", name: "codex-sim-order-workers" });
  assert.equal(state.consumers.length, 1);
});

test("normalizes new simulation names", () => {
  assert.equal(ensureSimName("Order Created", "codex-sim-topic"), "codex-sim-order-created");
  assert.equal(ensureSimName("codex-sim-ready", "codex-sim-topic"), "codex-sim-ready");
});
