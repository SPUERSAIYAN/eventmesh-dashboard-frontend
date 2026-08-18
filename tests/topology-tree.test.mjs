import assert from "node:assert/strict";
import test from "node:test";
import {
  buildResourceTree,
  filterResourceTree,
  findResourceNode,
  flattenResourceTree,
  resourceTreeExpandedKeys,
} from "../src/topologyTree.js";

const cluster = { id: "11", name: "prod-eventmesh", clusterType: "EVENTMESH_JVM_CLUSTER", status: "Healthy", version: "1.12.0" };
const topology = {
  key: "cluster-11", id: "11", name: "prod-eventmesh", kind: "cluster", clusterType: "EVENTMESH_JVM_CLUSTER", status: "Healthy", relation: "ROOT",
  children: [{
    key: "cluster-21", id: "21", name: "metadata-east", kind: "cluster", clusterType: "EVENTMESH_JVM_META", status: "Healthy", relation: "CLUSTER_RELATIONSHIP",
    children: [{ key: "runtime-201", id: "201", name: "nacos-1", kind: "runtime", host: "10.0.1.8", port: 8848, status: "Warning", relation: "RUNTIME_MEMBER", children: [] }],
  }, {
    key: "group-direct-runtimes-11", id: null, name: "Direct runtimes", kind: "group", status: "Healthy", relation: "DIRECT_RUNTIME_GROUP",
    children: [{ key: "runtime-101", id: "101", name: "runtime-a", kind: "runtime", host: "10.0.0.1", port: 10105, status: "Healthy", relation: "DIRECT_RUNTIME", children: [] }],
  }],
};

function resourceTree() {
  return buildResourceTree({
    cluster,
    topology,
    topics: [{ id: 301, topicName: "orders.created", status: "Healthy" }, { id: 301, topicName: "duplicate", status: "Healthy" }],
    groups: [{ id: 401, name: "billing-consumer", type: 0, state: "Warning" }],
    language: "zh",
  });
}

test("builds recursive topology and clearly separated resource directories", () => {
  const tree = resourceTree();
  const nodes = flattenResourceTree(tree);
  assert.equal(findResourceNode(tree, "runtime-201").parentKey, "cluster-21");
  assert.equal(findResourceNode(tree, "directory-access-11"), null);
  assert.equal(findResourceNode(tree, "directory-resources-11").virtual, true);
  assert.equal(nodes.filter((node) => node.key === "topic-301").length, 1);
  assert.equal(new Set(nodes.map((node) => node.key)).size, nodes.length);
});

test("search keeps the full ancestor path and expands it", () => {
  const tree = resourceTree();
  const result = filterResourceTree(tree, { query: "10.0.1.8", kind: "all", status: "all" });
  assert.equal(result.matchCount, 1);
  assert.deepEqual(result.tree.children.map((node) => node.key), ["cluster-21"]);
  assert.deepEqual(result.tree.children[0].children.map((node) => node.key), ["runtime-201"]);
  assert.ok(result.expandedKeys.includes("cluster-11"));
  assert.ok(result.expandedKeys.includes("cluster-21"));
});

test("filters by resource type and normalized status", () => {
  const tree = resourceTree();
  const topics = filterResourceTree(tree, { query: "", kind: "topic", status: "healthy" });
  const warnings = filterResourceTree(tree, { query: "", kind: "all", status: "warning" });
  assert.equal(topics.matchCount, 1);
  assert.equal(findResourceNode(topics.tree, "topic-301").title, "orders.created");
  assert.equal(warnings.matchCount, 2);
  assert.ok(findResourceNode(warnings.tree, "runtime-201"));
  assert.ok(findResourceNode(warnings.tree, "group-401"));
});

test("returns every expandable branch for expand-all", () => {
  const keys = resourceTreeExpandedKeys(resourceTree());
  assert.ok(keys.includes("cluster-11"));
  assert.ok(keys.includes("cluster-21"));
  assert.ok(keys.includes("directory-resources-11"));
  assert.ok(keys.includes("directory-topics-11"));
});
